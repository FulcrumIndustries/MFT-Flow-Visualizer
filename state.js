const StateManager = {
    state: {
        workspaces: new Map(),
        activeWorkspaceId: null,
        theme: 'light'
    },
    listeners: [],

    subscribe(listener) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    },

    notify(event) {
        this.listeners.forEach(listener => listener(event, this.state));
    },

    getActiveWorkspace() {
        return this.state.workspaces.get(this.state.activeWorkspaceId);
    },

    setActiveWorkspace(id) {
        if (this.state.workspaces.has(id)) {
            this.state.activeWorkspaceId = id;
            this.notify({ type: 'WORKSPACE_CHANGED', workspaceId: id });
        }
    },

    updatePattern(text) {
        const workspace = this.getActiveWorkspace();
        if (workspace) {
            workspace.patternText = text;
            workspace.metadata.updatedAt = Date.now();
            this.notify({ type: 'PATTERN_UPDATED', workspaceId: workspace.id });
        }
    },

    updateFlowNotes(flowIndex, text) {
        const workspace = this.getActiveWorkspace();
        if (workspace) {
            if (!workspace.flowNotes) {
                workspace.flowNotes = {};
            }
            workspace.flowNotes[flowIndex] = text;
            workspace.metadata.updatedAt = Date.now();
            this.notify({ type: 'FLOW_NOTES_UPDATED', workspaceId: workspace.id, flowIndex });
        }
    },

    getFlowNotes(flowIndex) {
        const workspace = this.getActiveWorkspace();
        if (workspace && workspace.flowNotes) {
            return workspace.flowNotes[flowIndex] || '';
        }
        return '';
    },

    updateFlowDescription(flowIndex, type, text) {
        // type is 'beforeSource' or 'afterTarget'
        const workspace = this.getActiveWorkspace();
        if (workspace) {
            if (!workspace.flowDescriptions) {
                workspace.flowDescriptions = {};
            }
            const key = `${flowIndex}-${type}`;
            workspace.flowDescriptions[key] = text;
            workspace.metadata.updatedAt = Date.now();
            this.notify({ type: 'FLOW_DESCRIPTION_UPDATED', workspaceId: workspace.id, flowIndex, descType: type });
        }
    },

    getFlowDescription(flowIndex, type) {
        // type is 'beforeSource' or 'afterTarget'
        const workspace = this.getActiveWorkspace();
        if (workspace && workspace.flowDescriptions) {
            const key = `${flowIndex}-${type}`;
            return workspace.flowDescriptions[key] || '';
        }
        return '';
    },

    updateAnnotation(flowIndex, edgeIndex, field, value) {
        const workspace = this.getActiveWorkspace();
        if (workspace) {
            if (!workspace.annotations) {
                workspace.annotations = {};
            }
            const key = `${flowIndex}-${edgeIndex}-${field}`;
            workspace.annotations[key] = value;
            workspace.metadata.updatedAt = Date.now();
            this.notify({ type: 'ANNOTATION_UPDATED', workspaceId: workspace.id });
        }
    },

    getAnnotation(flowIndex, edgeIndex, field) {
        const workspace = this.getActiveWorkspace();
        if (workspace && workspace.annotations) {
            const key = `${flowIndex}-${edgeIndex}-${field}`;
            return workspace.annotations[key] || '';
        }
        return '';
    },

    updateEdgeNotes(flowIndex, edgeIndex, type, text) {
        // type is 'pre' or 'post' for parallel steps
        const workspace = this.getActiveWorkspace();
        if (workspace) {
            if (!workspace.edgeNotes) {
                workspace.edgeNotes = {};
            }
            const key = `${flowIndex}-${edgeIndex}-${type}`;
            workspace.edgeNotes[key] = text;
            workspace.metadata.updatedAt = Date.now();
            this.notify({ type: 'EDGE_NOTES_UPDATED', workspaceId: workspace.id, flowIndex, edgeIndex });
        }
    },

    getEdgeNotes(flowIndex, edgeIndex, type) {
        // type is 'pre' or 'post' for parallel steps
        const workspace = this.getActiveWorkspace();
        if (workspace && workspace.edgeNotes) {
            const key = `${flowIndex}-${edgeIndex}-${type}`;
            return workspace.edgeNotes[key] || '';
        }
        return '';
    },

    toggleSelectedProduct(flowIndex, productName, isSelected) {
        const workspace = this.getActiveWorkspace();
        if (workspace) {
            if (!workspace.selectedProducts) {
                workspace.selectedProducts = {};
            }
            if (!workspace.selectedProducts[flowIndex]) {
                workspace.selectedProducts[flowIndex] = [];
            }
            
            const products = workspace.selectedProducts[flowIndex];
            const index = products.indexOf(productName);
            
            if (isSelected && index === -1) {
                products.push(productName);
            } else if (!isSelected && index !== -1) {
                products.splice(index, 1);
            }
            
            workspace.metadata.updatedAt = Date.now();
            this.notify({ type: 'SELECTED_PRODUCTS_UPDATED', workspaceId: workspace.id, flowIndex });
        }
    },

    getSelectedProducts(flowIndex) {
        const workspace = this.getActiveWorkspace();
        if (workspace && workspace.selectedProducts && workspace.selectedProducts[flowIndex]) {
            return workspace.selectedProducts[flowIndex];
        }
        return [];
    },

    setTheme(theme) {
        this.state.theme = theme;
        this.notify({ type: 'THEME_CHANGED', theme });
    }
};

// ============================================
// PERSISTENCE LAYER
// ============================================
const Persistence = {
    STORAGE_KEY: 'mft_flow_visualizer',
    VERSION: '1.1.0',

    save() {
        try {
            const data = {
                version: this.VERSION,
                activeWorkspaceId: StateManager.state.activeWorkspaceId,
                theme: StateManager.state.theme,
                workspaces: Array.from(StateManager.state.workspaces.entries()).map(([id, ws]) => ({
                    id: ws.id,
                    name: ws.name,
                    patternText: ws.patternText,
                    flowNotes: ws.flowNotes || {},
                    flowDescriptions: ws.flowDescriptions || {},
                    annotations: ws.annotations || {},
                    edgeNotes: ws.edgeNotes || {},
                    selectedProducts: ws.selectedProducts || {},
                    metadata: ws.metadata
                }))
            };
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.error('Failed to save:', e);
            return false;
        }
    },

    load() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (!raw) return null;

            const data = JSON.parse(raw);

            // Convert workspaces array back to Map
            const workspaces = new Map();
            if (data.workspaces) {
                data.workspaces.forEach(ws => {
                    workspaces.set(ws.id, {
                        ...ws,
                        flowNotes: ws.flowNotes || {},
                        flowDescriptions: ws.flowDescriptions || {},
                        annotations: ws.annotations || {},
                        edgeNotes: ws.edgeNotes || {},
                        selectedProducts: ws.selectedProducts || {}
                    });
                });
            }

            return {
                ...data,
                workspaces
            };
        } catch (e) {
            console.error('Failed to load:', e);
            return null;
        }
    },

    clear() {
        localStorage.removeItem(this.STORAGE_KEY);
    }
};

// ============================================
// WORKSPACE MANAGER
// ============================================
const WorkspaceManager = {
    createWorkspace(name = 'Untitled Workspace') {
        const id = generateId();
        const workspace = {
            id,
            name,
            patternText: '',
            flowNotes: {},
            flowDescriptions: {},
            annotations: {},
            metadata: {
                createdAt: Date.now(),
                updatedAt: Date.now(),
                version: '1.0.0'
            }
        };
        StateManager.state.workspaces.set(id, workspace);
        StateManager.setActiveWorkspace(id);
        Persistence.save();
        return workspace;
    },

    renameWorkspace(id, newName) {
        const workspace = StateManager.state.workspaces.get(id);
        if (workspace) {
            workspace.name = newName;
            workspace.metadata.updatedAt = Date.now();
            StateManager.notify({ type: 'WORKSPACE_RENAMED', workspaceId: id });
            Persistence.save();
        }
    },

    duplicateWorkspace(id) {
        const original = StateManager.state.workspaces.get(id);
        if (original) {
            const newId = generateId();
            const duplicate = {
                ...JSON.parse(JSON.stringify(original)),
                id: newId,
                name: original.name + ' (Copy)',
                metadata: {
                    createdAt: Date.now(),
                    updatedAt: Date.now(),
                    version: original.metadata.version
                }
            };
            StateManager.state.workspaces.set(newId, duplicate);
            StateManager.setActiveWorkspace(newId);
            Persistence.save();
            return duplicate;
        }
        return null;
    },

    deleteWorkspace(id) {
        if (StateManager.state.workspaces.size <= 1) {
            alert('Cannot delete the last workspace');
            return false;
        }

        StateManager.state.workspaces.delete(id);

        // Switch to another workspace
        const firstId = StateManager.state.workspaces.keys().next().value;
        StateManager.setActiveWorkspace(firstId);
        Persistence.save();
        return true;
    },

    initialize() {
        const saved = Persistence.load();

        if (saved && saved.workspaces.size > 0) {
            StateManager.state.workspaces = saved.workspaces;
            StateManager.state.theme = saved.theme || 'light';

            // Set active workspace
            if (saved.activeWorkspaceId && saved.workspaces.has(saved.activeWorkspaceId)) {
                StateManager.setActiveWorkspace(saved.activeWorkspaceId);
            } else {
                const firstId = saved.workspaces.keys().next().value;
                StateManager.setActiveWorkspace(firstId);
            }
        } else {
            // Create default workspace
            this.createWorkspace('My First Flow');
        }
    }
};
