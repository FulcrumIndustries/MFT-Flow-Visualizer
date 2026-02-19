const UIController = {
    elements: {},

    init() {
        // Cache DOM elements
        this.elements = {
            workspaceSelect: document.getElementById('workspaceSelect'),
            patternEditor: document.getElementById('patternEditor'),
            lineNumbers: document.getElementById('lineNumbers'),
            generalNotesField: document.getElementById('generalNotesField'),
            flowSelector: document.getElementById('flowSelector'),
            errorMessage: document.getElementById('errorMessage'),
            saveIndicator: document.getElementById('saveIndicator'),
            saveText: document.getElementById('saveText'),
            canvasContainer: document.getElementById('canvasContainer'),
            emptyState: document.getElementById('emptyState'),
            modalOverlay: document.getElementById('modalOverlay'),
            modalTitle: document.getElementById('modalTitle'),
            modalInput: document.getElementById('modalInput'),
            modalConfirmBtn: document.getElementById('modalConfirmBtn'),
            helpPanel: document.getElementById('helpPanel')
        };

        this.bindEvents();
    },

    bindEvents() {
        // Workspace controls
        document.getElementById('newWorkspaceBtn').addEventListener('click', () => {
            this.showModal('New Workspace', 'Untitled Workspace', 'Create', (name) => {
                WorkspaceManager.createWorkspace(name);
                this.updateWorkspaceSelect();
                this.loadActiveWorkspace();
            });
        });

        document.getElementById('renameWorkspaceBtn').addEventListener('click', () => {
            const ws = StateManager.getActiveWorkspace();
            if (ws) {
                this.showModal('Rename Workspace', ws.name, 'Rename', (name) => {
                    WorkspaceManager.renameWorkspace(ws.id, name);
                    this.updateWorkspaceSelect();
                });
            }
        });

        document.getElementById('duplicateWorkspaceBtn').addEventListener('click', () => {
            const ws = StateManager.getActiveWorkspace();
            if (ws) {
                WorkspaceManager.duplicateWorkspace(ws.id);
                this.updateWorkspaceSelect();
                this.loadActiveWorkspace();
            }
        });

        document.getElementById('deleteWorkspaceBtn').addEventListener('click', () => {
            const ws = StateManager.getActiveWorkspace();
            if (ws && confirm(`Delete workspace "${ws.name}"?`)) {
                WorkspaceManager.deleteWorkspace(ws.id);
                this.updateWorkspaceSelect();
                this.loadActiveWorkspace();
            }
        });

        // Export workspace
        document.getElementById('exportWorkspaceBtn').addEventListener('click', () => {
            const ws = StateManager.getActiveWorkspace();
            if (ws) {
                const exportData = {
                    version: 1,
                    exportedAt: new Date().toISOString(),
                    workspace: {
                        name: ws.name,
                        patternText: ws.patternText || '',
                        flowNotes: ws.flowNotes || {},
                        flowDescriptions: ws.flowDescriptions || {},
                        annotations: ws.annotations || {},
                        selectedProducts: ws.selectedProducts || {}
                    }
                };
                const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${ws.name.replace(/[^a-z0-9]/gi, '_')}_workspace.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }
        });

        // Import workspace
        const importFileInput = document.getElementById('importFileInput');
        document.getElementById('importWorkspaceBtn').addEventListener('click', () => {
            importFileInput.click();
        });

        importFileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    if (!data.workspace || !data.workspace.name) {
                        throw new Error('Invalid workspace file format');
                    }

                    // Create new workspace with imported data
                    const newWorkspace = WorkspaceManager.createWorkspace(data.workspace.name + ' (imported)');
                    // Update the workspace with imported content
                    newWorkspace.patternText = data.workspace.patternText || '';
                    newWorkspace.flowNotes = data.workspace.flowNotes || {};
                    newWorkspace.flowDescriptions = data.workspace.flowDescriptions || {};
                    newWorkspace.annotations = data.workspace.annotations || {};
                    newWorkspace.selectedProducts = data.workspace.selectedProducts || {};
                    Persistence.save();

                    this.updateWorkspaceSelect();
                    this.loadActiveWorkspace();
                    alert(`Workspace "${data.workspace.name}" imported successfully!`);
                } catch (err) {
                    alert('Failed to import workspace: ' + err.message);
                }
            };
            reader.readAsText(file);
            // Reset input so same file can be imported again
            importFileInput.value = '';
        });

        this.elements.workspaceSelect.addEventListener('change', (e) => {
            StateManager.setActiveWorkspace(e.target.value);
            this.loadActiveWorkspace();
        });

        // Pattern editor
        const debouncedUpdate = debounce(() => {
            this.updatePattern();
            this.setSaveIndicator('saving');
            Persistence.save();
            setTimeout(() => this.setSaveIndicator('saved'), 500);
        }, 300);

        this.elements.patternEditor.addEventListener('input', () => {
            this.updateLineNumbers();
            debouncedUpdate();
        });

        // Sync line numbers scroll with textarea scroll
        this.elements.patternEditor.addEventListener('scroll', () => {
            this.elements.lineNumbers.scrollTop = this.elements.patternEditor.scrollTop;
        });

        // Initial line numbers update
        this.updateLineNumbers();

        // Flow selector
        this.elements.flowSelector.addEventListener('change', (e) => {
            const flowIndex = e.target.value === '' ? null : parseInt(e.target.value);
            DiagramRenderer.selectFlow(flowIndex);
        });

        // General notes field
        const debouncedNotesUpdate = debounce(() => {
            const flowIndex = DiagramRenderer.selectedFlowIndex;
            if (flowIndex !== null) {
                StateManager.updateFlowNotes(flowIndex, this.elements.generalNotesField.value);
                this.setSaveIndicator('saving');
                Persistence.save();
                setTimeout(() => this.setSaveIndicator('saved'), 500);
            }
        }, 300);

        this.elements.generalNotesField.addEventListener('input', debouncedNotesUpdate);

        // Theme toggle
        document.getElementById('themeToggleBtn').addEventListener('click', () => {
            const newTheme = StateManager.state.theme === 'light' ? 'dark' : 'light';
            StateManager.setTheme(newTheme);
            document.body.setAttribute('data-theme', newTheme);
            this.updateThemeIcon();
            Persistence.save();
        });

        // Help panel
        document.getElementById('helpBtn').addEventListener('click', () => {
            this.elements.helpPanel.classList.add('visible');
        });

        document.getElementById('syntaxExplainBtn').addEventListener('click', () => {
            this.elements.helpPanel.classList.add('visible');
        });

        document.getElementById('closeHelpBtn').addEventListener('click', () => {
            this.elements.helpPanel.classList.remove('visible');
        });

        // Copy example buttons in help panel
        this.elements.helpPanel.querySelectorAll('.btn-copy-example').forEach(btn => {
            btn.addEventListener('click', () => {
                const text = btn.getAttribute('data-copy');
                if (text) {
                    navigator.clipboard.writeText(text).then(() => {
                        const orig = btn.textContent;
                        btn.textContent = 'Copied!';
                        btn.classList.add('copied');
                        setTimeout(() => {
                            btn.textContent = orig;
                            btn.classList.remove('copied');
                        }, 1500);
                    });
                }
            });
        });

        // Kroki diagram modal
        document.getElementById('krokiBtn').addEventListener('click', () => {
            this.showKrokiDiagram();
        });

        document.getElementById('closeKrokiBtn').addEventListener('click', () => {
            this.hideKrokiDiagram();
        });

        document.getElementById('krokiModal').addEventListener('click', (e) => {
            if (e.target.id === 'krokiModal') {
                this.hideKrokiDiagram();
            }
        });

        // Migration modal
        document.getElementById('closeMigrationBtn').addEventListener('click', () => {
            this.hideMigrationModal();
        });

        document.getElementById('migrationModal').addEventListener('click', (e) => {
            if (e.target.id === 'migrationModal') {
                this.hideMigrationModal();
            }
        });

        document.getElementById('krokiCopyCodeBtn').addEventListener('click', () => {
            if (this.currentKrokiCode) {
                navigator.clipboard.writeText(this.currentKrokiCode).then(() => {
                    const btn = document.getElementById('krokiCopyCodeBtn');
                    const originalText = btn.innerHTML;
                    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
                    setTimeout(() => {
                        btn.innerHTML = originalText;
                    }, 2000);
                });
            }
        });

        document.getElementById('krokiOpenExternalBtn').addEventListener('click', () => {
            if (this.currentKrokiUrl) {
                window.open(this.currentKrokiUrl, '_blank');
            }
        });

        // Kroki zoom controls
        document.getElementById('krokiZoomInBtn').addEventListener('click', () => {
            this.krokiZoom(0.25);
        });

        document.getElementById('krokiZoomOutBtn').addEventListener('click', () => {
            this.krokiZoom(-0.25);
        });

        document.getElementById('krokiZoomResetBtn').addEventListener('click', () => {
            this.krokiZoomReset();
        });

        // Kroki mouse wheel zoom
        const krokiContainer = document.getElementById('krokiCanvasContainer');
        krokiContainer.addEventListener('wheel', (e) => {
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const delta = e.deltaY > 0 ? -0.1 : 0.1;
                this.krokiZoom(delta);
            }
        }, { passive: false });

        // Kroki image drag/pan
        const krokiImage = document.getElementById('krokiImage');
        let krokiIsDragging = false;
        let krokiStartX = 0;
        let krokiStartY = 0;
        let krokiScrollLeft = 0;
        let krokiScrollTop = 0;

        krokiImage.addEventListener('mousedown', (e) => {
            if (e.button !== 0) return;
            krokiIsDragging = true;
            krokiImage.classList.add('dragging');
            krokiStartX = e.pageX - krokiContainer.offsetLeft;
            krokiStartY = e.pageY - krokiContainer.offsetTop;
            krokiScrollLeft = krokiContainer.scrollLeft;
            krokiScrollTop = krokiContainer.scrollTop;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!krokiIsDragging) return;
            const x = e.pageX - krokiContainer.offsetLeft;
            const y = e.pageY - krokiContainer.offsetTop;
            const walkX = (x - krokiStartX) * 1.5;
            const walkY = (y - krokiStartY) * 1.5;
            krokiContainer.scrollLeft = krokiScrollLeft - walkX;
            krokiContainer.scrollTop = krokiScrollTop - walkY;
        });

        document.addEventListener('mouseup', () => {
            if (krokiIsDragging) {
                krokiIsDragging = false;
                krokiImage.classList.remove('dragging');
            }
        });


        // Modal
        document.getElementById('modalCancelBtn').addEventListener('click', () => {
            this.hideModal();
        });

        this.elements.modalInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                this.elements.modalConfirmBtn.click();
            } else if (e.key === 'Escape') {
                this.hideModal();
            }
        });

        // Click outside modal to close
        this.elements.modalOverlay.addEventListener('click', (e) => {
            if (e.target === this.elements.modalOverlay) {
                this.hideModal();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                // Close migration modal if open
                const migrationModal = document.getElementById('migrationModal');
                if (migrationModal.classList.contains('visible')) {
                    this.hideMigrationModal();
                    return;
                }
                // Close kroki modal if open
                const krokiModal = document.getElementById('krokiModal');
                if (krokiModal.classList.contains('visible')) {
                    this.hideKrokiDiagram();
                    return;
                }
                // Close help/syntax panel if open
                if (this.elements.helpPanel.classList.contains('visible')) {
                    this.elements.helpPanel.classList.remove('visible');
                    return;
                }
            }
            if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                document.getElementById('themeToggleBtn').click();
            } else if (e.ctrlKey && e.key === 'n') {
                e.preventDefault();
                document.getElementById('newWorkspaceBtn').click();
            }
        });
    },

    updateWorkspaceSelect() {
        const select = this.elements.workspaceSelect;
        select.innerHTML = '';

        StateManager.state.workspaces.forEach((ws, id) => {
            const option = document.createElement('option');
            option.value = id;
            option.textContent = ws.name;
            option.selected = id === StateManager.state.activeWorkspaceId;
            select.appendChild(option);
        });
    },

    loadActiveWorkspace() {
        const ws = StateManager.getActiveWorkspace();
        if (ws) {
            this.elements.patternEditor.value = ws.patternText || '';
            DiagramRenderer.selectedFlowIndex = null;
            this.updateLineNumbers();
            this.updatePattern();
        }
    },

    updatePattern() {
        const text = this.elements.patternEditor.value;
        StateManager.updatePattern(text);

        const result = Parser.parseMultiple(text);

        if (result.errors.length > 0) {
            this.showErrors(result.errors);
        } else {
            this.hideError();
        }

        // Migrate annotations from index-based to signature-based keys so comments stay with the same connection when the pattern is edited
        result.flows.forEach((flow, flowIndex) => {
            if (flow && flow.edges) {
                StateManager.migrateAnnotationsToSignature(flowIndex, flow.edges);
            }
        });

        DiagramRenderer.render(result.flows, this.elements.canvasContainer);

        // Update flow analysis panel
        this.updateFlowAnalysis(result.flows, text);
    },

    updateFlowAnalysis(flows, text) {
        // Update stats
        const flowCount = flows.length;
        const uniqueNodes = new Set();
        const protocolsUsed = new Map();

        flows.forEach(flow => {
            if (flow && flow.nodes) {
                flow.nodes.forEach(node => {
                    uniqueNodes.add(node.label);
                });
            }
            if (flow && flow.edges) {
                flow.edges.forEach(edge => {
                    const protocol = edge.protocol;
                    if (protocol) {
                        protocolsUsed.set(protocol, (protocolsUsed.get(protocol) || 0) + 1);
                    }
                });
            }
        });

        document.getElementById('statFlowCount').textContent = flowCount;
        document.getElementById('statNodeCount').textContent = uniqueNodes.size;
        document.getElementById('statProtocolCount').textContent = protocolsUsed.size;

        // Update protocol tags
        const protocolTags = document.getElementById('protocolTags');
        if (protocolsUsed.size > 0) {
            protocolTags.innerHTML = Array.from(protocolsUsed.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([protocol, count]) =>
                    `<span class="protocol-tag" data-protocol="${protocol}">${protocol}<span class="tag-count">${count}</span></span>`
                ).join('');

            // Add click handlers for protocol tags
            protocolTags.querySelectorAll('.protocol-tag').forEach(tag => {
                tag.addEventListener('click', () => {
                    const protocol = tag.dataset.protocol;
                    this.highlightProtocolInEditor(protocol);
                });
            });
        } else {
            protocolTags.innerHTML = '<span style="color: var(--text-muted); font-size: 11px; font-style: italic;">No protocols detected</span>';
        }
    },

    highlightProtocolInEditor(protocol) {
        const editor = this.elements.patternEditor;
        const text = editor.value;
        const regex = new RegExp(protocol, 'gi');
        const match = regex.exec(text);

        if (match) {
            editor.focus();
            editor.setSelectionRange(match.index, match.index + match[0].length);

            // Calculate approximate line and scroll
            const textBefore = text.substring(0, match.index);
            const lineNum = textBefore.split('\n').length;
            this.scrollToLine(lineNum);
        }
    },

    scrollToLine(lineNum) {
        const editor = this.elements.patternEditor;
        const lineHeight = 22.4; // matches CSS
        const scrollTop = (lineNum - 1) * lineHeight;
        editor.scrollTop = scrollTop;
        this.elements.lineNumbers.scrollTop = scrollTop;
    },

    showErrors(errors) {
        const errorHtml = errors.map(e =>
            `<div class="error-line">Line ${e.line}: ${e.message}</div>`
        ).join('');
        this.elements.errorMessage.innerHTML = errorHtml;
        this.elements.errorMessage.classList.add('visible');
    },

    hideError() {
        this.elements.errorMessage.classList.remove('visible');
    },

    updateLineNumbers() {
        const text = this.elements.patternEditor.value;
        const lines = text.split('\n');
        const lineCount = lines.length || 1;

        // Generate line numbers HTML
        let lineNumbersHtml = '';
        for (let i = 1; i <= lineCount; i++) {
            lineNumbersHtml += `<span>${i}</span>`;
        }

        this.elements.lineNumbers.innerHTML = lineNumbersHtml;
    },

    setSaveIndicator(status) {
        const indicator = this.elements.saveIndicator;
        indicator.classList.remove('saving', 'saved');
        indicator.classList.add(status);
        this.elements.saveText.textContent = status === 'saving' ? 'Saving...' : 'Saved';
    },

    async copyFlowAsPng(flowRow, flowIndex) {
        if (typeof html2canvas === 'undefined') {
            alert('PNG export library not loaded. Please refresh the page.');
            return;
        }

        const copyBtn = flowRow.querySelector('.flow-copy-btn');
        const originalHtml = copyBtn.innerHTML;

        try {
            // Show loading state
            copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M12 6v6l4 2"></path>
            </svg>`;

            // Create a wrapper container for the entire export
            const wrapper = document.createElement('div');
            wrapper.style.position = 'absolute';
            wrapper.style.left = '-9999px';
            wrapper.style.top = '0';
            wrapper.style.backgroundColor = '#ffffff';
            wrapper.style.padding = '24px';
            wrapper.style.borderRadius = '8px';
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.gap = '16px';
            wrapper.style.fontFamily = 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

            // Add flow title
            const title = document.createElement('div');
            title.style.fontSize = '16px';
            title.style.fontWeight = '600';
            title.style.color = '#1e293b';
            title.style.borderBottom = '2px solid #e2e8f0';
            title.style.paddingBottom = '8px';
            title.textContent = `Flow ${flowIndex + 1}`;
            wrapper.appendChild(title);

            // Clone the flow row for rendering
            const clone = flowRow.cloneNode(true);
            clone.style.backgroundColor = 'transparent';
            clone.style.display = 'inline-flex';
            clone.style.border = 'none';
            clone.style.boxShadow = 'none';
            
            // Remove the copy button and row header from clone
            clone.querySelectorAll('.flow-row-header').forEach(el => el.remove());
            clone.querySelectorAll('.flow-copy-btn').forEach(el => el.remove());

            // Replace inputs/textareas with static text divs to preserve values
            clone.querySelectorAll('input, textarea').forEach(el => {
                const value = el.value || el.placeholder || '';
                const staticDiv = document.createElement('div');
                staticDiv.textContent = value;
                staticDiv.style.padding = '6px 8px';
                staticDiv.style.fontSize = '11px';
                staticDiv.style.color = value === el.placeholder ? '#94a3b8' : '#334155';
                staticDiv.style.fontStyle = value === el.placeholder ? 'italic' : 'normal';
                staticDiv.style.background = '#fffbeb';
                staticDiv.style.border = '1px dashed #fcd34d';
                staticDiv.style.borderRadius = '4px';
                staticDiv.style.textAlign = 'center';
                staticDiv.style.minHeight = el.tagName === 'TEXTAREA' ? '40px' : 'auto';
                staticDiv.style.whiteSpace = el.tagName === 'TEXTAREA' ? 'pre-wrap' : 'nowrap';
                if (el.parentNode) {
                    el.parentNode.replaceChild(staticDiv, el);
                }
            });
            
            // Fix arrow lines for rendering
            clone.querySelectorAll('.edge-line').forEach(el => {
                el.style.backgroundImage = 'none';
                el.style.backgroundColor = '#64748b';
                el.style.animation = 'none';
            });
            clone.querySelectorAll('.edge-arrow').forEach(el => {
                if (el.classList.contains('reverse')) {
                    el.style.borderRightColor = '#64748b';
                } else {
                    el.style.borderLeftColor = '#64748b';
                }
            });

            // Fix node colors for light background
            clone.querySelectorAll('.node-box.source').forEach(el => {
                el.style.background = '#dbeafe';
                el.style.borderColor = '#3b82f6';
                el.style.color = '#1e40af';
            });
            clone.querySelectorAll('.node-box.intermediate').forEach(el => {
                el.style.background = '#fef9c3';
                el.style.borderColor = '#eab308';
                el.style.color = '#713f12';
            });
            clone.querySelectorAll('.node-box.target').forEach(el => {
                el.style.background = '#dcfce7';
                el.style.borderColor = '#22c55e';
                el.style.color = '#166534';
            });

            // Fix text colors
            clone.querySelectorAll('.node-type, .flow-description-label, .edge-notes-label, .annotation-label').forEach(el => {
                el.style.color = '#64748b';
            });
            clone.querySelectorAll('.edge-protocol').forEach(el => {
                el.style.background = '#eff6ff';
                el.style.borderColor = '#3b82f6';
                el.style.color = '#1d4ed8';
            });

            wrapper.appendChild(clone);

            // Add General Notes section if there are notes
            const generalNotes = StateManager.getFlowNotes(flowIndex);
            if (generalNotes && generalNotes.trim()) {
                const notesSection = document.createElement('div');
                notesSection.style.marginTop = '8px';
                notesSection.style.padding = '12px';
                notesSection.style.background = '#f8fafc';
                notesSection.style.borderRadius = '6px';
                notesSection.style.border = '1px solid #e2e8f0';

                const notesLabel = document.createElement('div');
                notesLabel.style.fontSize = '10px';
                notesLabel.style.fontWeight = '600';
                notesLabel.style.color = '#64748b';
                notesLabel.style.textTransform = 'uppercase';
                notesLabel.style.letterSpacing = '0.5px';
                notesLabel.style.marginBottom = '6px';
                notesLabel.textContent = 'GENERAL NOTES';
                notesSection.appendChild(notesLabel);

                const notesContent = document.createElement('div');
                notesContent.style.fontSize = '12px';
                notesContent.style.color = '#334155';
                notesContent.style.whiteSpace = 'pre-wrap';
                notesContent.style.lineHeight = '1.5';
                notesContent.textContent = generalNotes;
                notesSection.appendChild(notesContent);

                wrapper.appendChild(notesSection);
            }

            document.body.appendChild(wrapper);

            // Wait for rendering
            await new Promise(resolve => setTimeout(resolve, 100));

            // Capture as canvas
            const canvas = await html2canvas(wrapper, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                logging: false
            });

            // Clean up wrapper
            document.body.removeChild(wrapper);

            // Convert to blob and copy to clipboard
            canvas.toBlob(async (blob) => {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    
                    // Show success
                    copyBtn.classList.add('copied');
                    copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>`;
                    
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyBtn.innerHTML = originalHtml;
                    }, 2000);
                } catch (err) {
                    console.error('Failed to copy to clipboard:', err);
                    // Fallback: download the image
                    const link = document.createElement('a');
                    link.download = `flow_${flowIndex + 1}.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                    
                    copyBtn.innerHTML = originalHtml;
                }
            }, 'image/png');

        } catch (error) {
            console.error('Failed to generate PNG:', error);
            alert('Failed to generate PNG: ' + error.message);
            copyBtn.innerHTML = originalHtml;
        }
    },

    showModal(title, defaultValue, confirmText, onConfirm) {
        this.elements.modalTitle.textContent = title;
        this.elements.modalInput.value = defaultValue;
        this.elements.modalConfirmBtn.textContent = confirmText;
        this.elements.modalOverlay.classList.add('visible');
        this.elements.modalInput.focus();
        this.elements.modalInput.select();

        const confirmHandler = () => {
            const value = this.elements.modalInput.value.trim();
            if (value) {
                onConfirm(value);
                this.hideModal();
            }
        };

        this.elements.modalConfirmBtn.onclick = confirmHandler;
    },

    hideModal() {
        this.elements.modalOverlay.classList.remove('visible');
    },

    // Kroki diagram state
    currentKrokiCode: null,
    currentKrokiUrl: null,
    krokiZoomLevel: 4.5,
    krokiMinZoom: 0.5,
    krokiMaxZoom: 10,
    krokiBaseWidth: null,
    krokiBaseHeight: null,

    krokiZoom(delta) {
        const newZoom = Math.max(this.krokiMinZoom, Math.min(this.krokiMaxZoom, this.krokiZoomLevel + delta));
        if (newZoom !== this.krokiZoomLevel) {
            this.krokiZoomLevel = newZoom;
            this.applyKrokiZoom();
        }
    },

    krokiZoomReset() {
        this.krokiZoomLevel = 1;
        this.applyKrokiZoom();
        // Also reset scroll position to center
        const container = document.getElementById('krokiCanvasContainer');
        const wrapper = document.getElementById('krokiImageWrapper');
        setTimeout(() => {
            container.scrollLeft = (wrapper.scrollWidth - container.clientWidth) / 2;
            container.scrollTop = (wrapper.scrollHeight - container.clientHeight) / 2;
        }, 50);
    },

    applyKrokiZoom() {
        const image = document.getElementById('krokiImage');
        const zoomLabel = document.getElementById('krokiZoomLevel');
        
        if (this.krokiBaseWidth && this.krokiBaseHeight) {
            image.style.width = `${this.krokiBaseWidth * this.krokiZoomLevel}px`;
            image.style.height = `${this.krokiBaseHeight * this.krokiZoomLevel}px`;
        }
        zoomLabel.textContent = `${Math.round(this.krokiZoomLevel * 100)}%`;
    },

    async showKrokiDiagram() {
        const modal = document.getElementById('krokiModal');
        const loading = document.getElementById('krokiLoading');
        const image = document.getElementById('krokiImage');

        // Get current flows
        const text = this.elements.patternEditor.value;
        const result = Parser.parseMultiple(text);
        const flows = result.flows;

        if (flows.length === 0) {
            alert('No flows defined. Add some flow patterns first.');
            return;
        }

        // Show modal with loading state
        modal.classList.add('visible');
        loading.classList.remove('hidden');
        image.classList.remove('visible');

        // Build unique nodes and connections
        const uniqueNodes = new Map();
        const uniqueConnections = new Map();

        flows.forEach(flow => {
            if (!flow || !flow.nodes || !flow.edges) return;

            flow.nodes.forEach(node => {
                if (!uniqueNodes.has(node.label)) {
                    uniqueNodes.set(node.label, {
                        label: node.label,
                        type: node.type
                    });
                }
            });

            flow.edges.forEach(edge => {
                const connectionKey = `${edge.fromLabel}|${edge.toLabel}|${edge.protocol}|${edge.direction}`;
                if (!uniqueConnections.has(connectionKey)) {
                    uniqueConnections.set(connectionKey, {
                        from: edge.fromLabel,
                        to: edge.toLabel,
                        protocol: edge.protocol,
                        direction: edge.direction,
                        flowDirection: edge.flowDirection
                    });
                }
            });
        });

        // Update stats
        document.getElementById('krokiStatNodes').textContent = uniqueNodes.size;
        document.getElementById('krokiStatConnections').textContent = uniqueConnections.size;

        // Generate D2 code
        const d2Code = this.generateD2Code(uniqueNodes, uniqueConnections);
        this.currentKrokiCode = d2Code;

        try {
            // Encode D2 code for Kroki API
            const encoded = this.encodeKrokiDiagram(d2Code);
            const krokiUrl = `https://kroki.io/d2/svg/${encoded}`;
            this.currentKrokiUrl = krokiUrl;

            // Fetch the diagram
            const response = await fetch(krokiUrl);
            if (!response.ok) {
                throw new Error(`Kroki API error: ${response.status}`);
            }

            const svgText = await response.text();
            
            // Convert SVG to data URL for the image
            const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
            const svgUrl = URL.createObjectURL(svgBlob);

            image.onload = () => {
                // Store the natural dimensions as base for zoom
                this.krokiBaseWidth = image.naturalWidth;
                this.krokiBaseHeight = image.naturalHeight;
                
                // Set initial zoom to 450%
                this.krokiZoomLevel = 4.5;
                image.style.width = `${this.krokiBaseWidth * this.krokiZoomLevel}px`;
                image.style.height = `${this.krokiBaseHeight * this.krokiZoomLevel}px`;
                document.getElementById('krokiZoomLevel').textContent = '450%';
                
                loading.classList.add('hidden');
                image.classList.add('visible');
                URL.revokeObjectURL(svgUrl);
                
                // Center the view after image loads
                const container = document.getElementById('krokiCanvasContainer');
                const wrapper = document.getElementById('krokiImageWrapper');
                setTimeout(() => {
                    container.scrollLeft = Math.max(0, (wrapper.scrollWidth - container.clientWidth) / 2);
                    container.scrollTop = Math.max(0, (wrapper.scrollHeight - container.clientHeight) / 2);
                }, 50);
            };

            image.onerror = () => {
                loading.innerHTML = `<div class="kroki-error"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg><span>Failed to load diagram</span></div>`;
            };

            image.src = svgUrl;
        } catch (error) {
            console.error('Kroki diagram error:', error);
            loading.innerHTML = `<div class="kroki-error"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg><span>Failed to generate diagram: ${error.message}</span></div>`;
        }
    },

    hideKrokiDiagram() {
        const modal = document.getElementById('krokiModal');
        const loading = document.getElementById('krokiLoading');
        const image = document.getElementById('krokiImage');
        
        modal.classList.remove('visible');
        
        // Reset state for next time
        loading.classList.remove('hidden');
        loading.innerHTML = `<div class="kroki-spinner"></div><span>Generating diagram...</span>`;
        image.classList.remove('visible');
        image.src = '';
        
        // Reset zoom
        this.krokiZoomLevel = 1;
        this.krokiBaseWidth = null;
        this.krokiBaseHeight = null;
        image.style.width = '';
        image.style.height = '';
        document.getElementById('krokiZoomLevel').textContent = '100%';
    },

    // Store current migration state for re-rendering
    currentMigrationState: null,

    showMigrationOptions(flowIndex, flow, includeScripted = true) {
        const modal = document.getElementById('migrationModal');
        const content = document.getElementById('migrationContent');
        
        // Get selected products for this flow
        const selectedProducts = StateManager.getSelectedProducts(flowIndex);
        
        // Store state for toggle functionality
        this.currentMigrationState = { flowIndex, flow, selectedProducts };
        
        if (selectedProducts.length === 0) {
            content.innerHTML = `
                <div class="migration-empty">
                    <svg class="migration-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h3>No Products Selected</h3>
                    <p>Please select at least one product from the "Potential Products" section to see migration options.</p>
                </div>
            `;
            modal.classList.add('visible');
            return;
        }

        // Find intermediate nodes that need products
        const intermediateNodes = flow.nodes.filter(n => n.type === 'intermediate');
        
        if (intermediateNodes.length === 0) {
            content.innerHTML = `
                <div class="migration-empty">
                    <svg class="migration-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                        <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <h3>Direct Flow</h3>
                    <p>This is a direct flow with no intermediate nodes. No migration planning needed.</p>
                </div>
            `;
            modal.classList.add('visible');
            return;
        }

        // For each intermediate node, determine required capabilities
        const nodeRequirements = this.analyzeNodeRequirements(flow);
        
        // Find which products can serve each node (with scripting option)
        const nodeProductOptions = this.findProductOptionsForNodes(nodeRequirements, selectedProducts, includeScripted);
        
        // Check if any node has no valid product
        const unsatisfiedNodes = Object.entries(nodeProductOptions)
            .filter(([node, options]) => options.length === 0);
        
        if (unsatisfiedNodes.length > 0) {
            const nodeList = unsatisfiedNodes.map(([node]) => node).join(', ');
            
            // Check if there would be options with scripting enabled
            let scriptingHint = '';
            if (!includeScripted) {
                const withScripted = this.findProductOptionsForNodes(nodeRequirements, selectedProducts, true);
                const wouldHaveOptions = unsatisfiedNodes.every(([node]) => withScripted[node]?.length > 0);
                if (wouldHaveOptions) {
                    scriptingHint = `<p style="margin-top: 12px; color: var(--accent-primary);">💡 Enable "Include Scripted Options" to see solutions using script capabilities.</p>`;
                }
            }
            
            content.innerHTML = `
                <div class="migration-toggle-container">
                    <label class="migration-toggle">
                        <input type="checkbox" id="includeScriptedToggle" ${includeScripted ? 'checked' : ''}>
                        <span class="migration-toggle-slider"></span>
                        <span class="migration-toggle-label">Include Scripted Options</span>
                    </label>
                </div>
                <div class="migration-empty">
                    <svg class="migration-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="15" y1="9" x2="9" y2="15"></line>
                        <line x1="9" y1="9" x2="15" y2="15"></line>
                    </svg>
                    <h3>Incompatible Products</h3>
                    <p>The selected products cannot satisfy all requirements for node(s): <strong>${nodeList}</strong></p>
                    <p style="margin-top: 8px;">Please select additional products that support the required protocols.</p>
                    ${scriptingHint}
                </div>
            `;
            this.attachMigrationToggleListener();
            modal.classList.add('visible');
            return;
        }

        // Generate all valid combinations
        const combinations = this.generateMigrationCombinations(nodeProductOptions, intermediateNodes.map(n => n.label), includeScripted);
        
        // Count native vs scripted options
        const nativeCount = combinations.filter(c => !c.hasScripting).length;
        const scriptedCount = combinations.filter(c => c.hasScripting).length;
        
        // Limit to reasonable number of options
        const maxOptions = 10;
        const displayCombinations = combinations.slice(0, maxOptions);
        
        // Build header with toggle and stats
        let html = `
            <div class="migration-toggle-container">
                <label class="migration-toggle">
                    <input type="checkbox" id="includeScriptedToggle" ${includeScripted ? 'checked' : ''}>
                    <span class="migration-toggle-slider"></span>
                    <span class="migration-toggle-label">Include Scripted Options</span>
                </label>
                <div class="migration-stats">
                    <span class="migration-stat native">${nativeCount} native</span>
                    ${scriptedCount > 0 ? `<span class="migration-stat scripted">${scriptedCount} with scripts</span>` : ''}
                </div>
            </div>
        `;
        
        // Render migration options
        displayCombinations.forEach((combo, index) => {
            html += this.renderMigrationOption(flow, combo, index + 1, Math.min(combinations.length, maxOptions));
        });
        
        if (combinations.length > maxOptions) {
            html += `
                <div class="migration-empty" style="padding: 20px;">
                    <p>Showing ${maxOptions} of ${combinations.length} possible combinations. Select fewer products for fewer options.</p>
                </div>
            `;
        }
        
        if (combinations.length === 0) {
            html += `
                <div class="migration-empty">
                    <svg class="migration-empty-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <h3>No Options Available</h3>
                    <p>No valid migration paths found with current settings.</p>
                    ${!includeScripted ? `<p style="margin-top: 8px; color: var(--accent-primary);">Try enabling "Include Scripted Options" for more possibilities.</p>` : ''}
                </div>
            `;
        }
        
        content.innerHTML = html;
        this.attachMigrationToggleListener();
        modal.classList.add('visible');
    },

    attachMigrationToggleListener() {
        const toggle = document.getElementById('includeScriptedToggle');
        if (toggle && this.currentMigrationState) {
            toggle.addEventListener('change', (e) => {
                const { flowIndex, flow } = this.currentMigrationState;
                this.showMigrationOptions(flowIndex, flow, e.target.checked);
            });
        }
    },

    analyzeNodeRequirements(flow) {
        const requirements = {};
        
        // Create node type map
        const nodeMap = new Map();
        flow.nodes.forEach(node => {
            nodeMap.set(node.label, node.type);
        });
        
        flow.edges.forEach(edge => {
            const fromType = nodeMap.get(edge.fromLabel);
            const toType = nodeMap.get(edge.toLabel);
            
            // Determine client and server based on flow direction
            let clientNode, serverNode;
            if (edge.flowDirection === 'reverse') {
                clientNode = edge.toLabel;
                serverNode = edge.fromLabel;
            } else {
                clientNode = edge.fromLabel;
                serverNode = edge.toLabel;
            }
            
            const clientType = nodeMap.get(clientNode);
            const serverType = nodeMap.get(serverNode);
            
            // If client is intermediate, it needs client capability
            if (clientType === 'intermediate') {
                if (!requirements[clientNode]) {
                    requirements[clientNode] = { client: [], server: [] };
                }
                requirements[clientNode].client.push(`${edge.protocol} ${edge.direction}`);
            }
            
            // If server is intermediate, it needs server capability
            if (serverType === 'intermediate') {
                if (!requirements[serverNode]) {
                    requirements[serverNode] = { client: [], server: [] };
                }
                requirements[serverNode].server.push(`${edge.protocol} SERVER`);
            }
        });
        
        return requirements;
    },

    findProductOptionsForNodes(nodeRequirements, selectedProducts, includeScripted = true) {
        const nodeProductOptions = {};
        
        for (const [nodeName, requirements] of Object.entries(nodeRequirements)) {
            nodeProductOptions[nodeName] = [];
            
            for (const productName of selectedProducts) {
                const product = PRODUCT_CAPABILITIES[productName];
                if (!product) continue;
                
                // Get extended capabilities (native + scripted if enabled)
                const clientCaps = getExtendedCapabilities(productName, 'client');
                const serverCaps = getExtendedCapabilities(productName, 'server');
                
                // Track which capabilities are satisfied natively vs via script
                const scriptedCapabilities = [];
                let canSatisfy = true;
                
                // Check client capabilities
                for (const cap of requirements.client) {
                    const capUpper = cap.toUpperCase();
                    const isNative = clientCaps.native.some(c => c.toUpperCase() === capUpper);
                    const isScripted = clientCaps.scripted.some(c => c.toUpperCase() === capUpper);
                    
                    if (isNative) {
                        // Satisfied natively - good
                    } else if (isScripted && includeScripted) {
                        // Satisfied via script
                        scriptedCapabilities.push(cap);
                    } else {
                        canSatisfy = false;
                        break;
                    }
                }
                
                // Check server capabilities
                if (canSatisfy) {
                    for (const cap of requirements.server) {
                        const capUpper = cap.toUpperCase();
                        const isNative = serverCaps.native.some(s => s.toUpperCase() === capUpper);
                        const isScripted = serverCaps.scripted.some(s => s.toUpperCase() === capUpper);
                        
                        if (isNative) {
                            // Satisfied natively - good
                        } else if (isScripted && includeScripted) {
                            // Satisfied via script
                            scriptedCapabilities.push(cap);
                        } else {
                            canSatisfy = false;
                            break;
                        }
                    }
                }
                
                if (canSatisfy) {
                    nodeProductOptions[nodeName].push({
                        product: productName,
                        scriptedCapabilities: scriptedCapabilities,
                        isFullyNative: scriptedCapabilities.length === 0
                    });
                }
            }
            
            // Sort: native solutions first, then scripted
            nodeProductOptions[nodeName].sort((a, b) => {
                if (a.isFullyNative && !b.isFullyNative) return -1;
                if (!a.isFullyNative && b.isFullyNative) return 1;
                return a.scriptedCapabilities.length - b.scriptedCapabilities.length;
            });
        }
        
        return nodeProductOptions;
    },

    generateMigrationCombinations(nodeProductOptions, nodeNames, includeScripted = true) {
        const combinations = [];
        
        // Recursive function to generate all combinations
        const generate = (index, current) => {
            if (index === nodeNames.length) {
                // Calculate if this combination uses any scripting
                const hasScripting = Object.values(current).some(opt => opt.scriptedCapabilities.length > 0);
                combinations.push({
                    assignments: {...current},
                    hasScripting: hasScripting,
                    totalScriptedCount: Object.values(current).reduce((sum, opt) => sum + opt.scriptedCapabilities.length, 0)
                });
                return;
            }
            
            const nodeName = nodeNames[index];
            const options = nodeProductOptions[nodeName] || [];
            
            for (const option of options) {
                // If not including scripted, skip options that require scripting
                if (!includeScripted && option.scriptedCapabilities.length > 0) {
                    continue;
                }
                current[nodeName] = option;
                generate(index + 1, current);
            }
        };
        
        generate(0, {});
        
        // Sort combinations: fully native first, then by scripted count
        combinations.sort((a, b) => {
            if (!a.hasScripting && b.hasScripting) return -1;
            if (a.hasScripting && !b.hasScripting) return 1;
            return a.totalScriptedCount - b.totalScriptedCount;
        });
        
        return combinations;
    },

    /**
     * Renders one segment of the migration diagram from a given node, handling
     * parallel inputs (multiple protocols to same target) and parallel outputs (branching).
     */
    renderMigrationSegment(nodeId, flow, assignments, nodeMap, nodeById, edgesByFromNodeId) {
        const node = nodeById.get(nodeId);
        if (!node) return '';

        const nodeType = node.type;
        const assignment = assignments[node.label];
        const productName = assignment ? assignment.product : '';
        const hasNodeScripting = assignment && assignment.scriptedCapabilities.length > 0;

        let productLabelHtml = '';
        if (productName) {
            const scriptedCapsForNode = hasNodeScripting ? assignment.scriptedCapabilities : [];
            const scriptedTitle = scriptedCapsForNode.length > 0
                ? `${productName}\n+ Script: ${scriptedCapsForNode.join(', ')}`
                : productName;
            productLabelHtml = `
                <div class="migration-product-label ${hasNodeScripting ? 'has-scripting' : ''}" title="${scriptedTitle.replace(/"/g, '&quot;')}">
                    ${productName}
                    ${hasNodeScripting ? '<span class="scripting-indicator">+Script</span>' : ''}
                </div>
            `;
        }

        let html = `
            <div class="migration-node">
                <div class="migration-node-box ${nodeType}">${node.label}</div>
                ${productLabelHtml}
            </div>
        `;

        const outEdges = edgesByFromNodeId.get(nodeId) || [];
        if (outEdges.length === 0) return html;

        // Group edges by target node (toNodeId)
        const byTarget = new Map();
        outEdges.forEach(e => {
            const tid = e.toNodeId;
            if (!tid) return;
            if (!byTarget.has(tid)) byTarget.set(tid, []);
            byTarget.get(tid).push(e);
        });

        if (byTarget.size === 1) {
            // Single target: one or more edges = parallel inputs when multiple
            const [targetId, edges] = [...byTarget.entries()][0];
            const firstEdge = edges[0];
            const isReverse = firstEdge.flowDirection === 'reverse';
            const edgeFromThisNode = firstEdge.fromLabel === node.label;
            const showReverse = (edgeFromThisNode && isReverse) || (!edgeFromThisNode && !isReverse);
            const edgeLabels = edges.map(e => `${e.protocol} ${e.direction}`);
            const isParallelInput = edges.length > 1;
            const labelText = isParallelInput ? `(${edgeLabels.join(' & ')})` : edgeLabels[0];
            html += `
                <div class="migration-edge ${isParallelInput ? 'parallel' : ''}">
                    ${showReverse ? '<div class="migration-edge-arrow reverse"></div>' : ''}
                    <div class="migration-edge-line"></div>
                    <div class="migration-edge-label ${isParallelInput ? 'parallel-label' : ''}">${labelText}</div>
                    <div class="migration-edge-line"></div>
                    ${!showReverse ? '<div class="migration-edge-arrow"></div>' : ''}
                </div>
            `;
            html += this.renderMigrationSegment(targetId, flow, assignments, nodeMap, nodeById, edgesByFromNodeId);
        } else {
            // Parallel outputs: multiple targets, render one branch per target (order by step number when present)
            const entries = [...byTarget.entries()].sort((a, b) => {
                const stepA = Math.min(...a[1].map(e => e.stepNumber || 999));
                const stepB = Math.min(...b[1].map(e => e.stepNumber || 999));
                return stepA - stepB;
            });
            html += '<div class="migration-parallel-outputs">';
            entries.forEach(([targetId, edges]) => {
                html += '<div class="migration-parallel-branch">';
                const firstEdge = edges[0];
                const isReverse = firstEdge.flowDirection === 'reverse';
                const edgeFromThisNode = firstEdge.fromLabel === node.label;
                const showReverse = (edgeFromThisNode && isReverse) || (!edgeFromThisNode && !isReverse);
                const edgeLabels = edges.map(e => `${e.protocol} ${e.direction}`);
                const isParallelInput = edges.length > 1;
                const labelText = isParallelInput ? `(${edgeLabels.join(' & ')})` : edgeLabels[0];
                html += `
                    <div class="migration-edge ${isParallelInput ? 'parallel' : ''}">
                        ${showReverse ? '<div class="migration-edge-arrow reverse"></div>' : ''}
                        <div class="migration-edge-line"></div>
                        <div class="migration-edge-label ${isParallelInput ? 'parallel-label' : ''}">${labelText}</div>
                        <div class="migration-edge-line"></div>
                        ${!showReverse ? '<div class="migration-edge-arrow"></div>' : ''}
                    </div>
                `;
                html += this.renderMigrationSegment(targetId, flow, assignments, nodeMap, nodeById, edgesByFromNodeId);
                html += '</div>';
            });
            html += '</div>';
        }
        return html;
    },

    renderMigrationOption(flow, combination, optionNumber, totalOptions) {
        const { assignments, hasScripting, totalScriptedCount } = combination;
        
        // Create node type map
        const nodeMap = new Map();
        flow.nodes.forEach(node => {
            nodeMap.set(node.label, node.type);
        });
        
        // Get unique products used (extract product name from assignment object)
        const productsUsed = [...new Set(Object.values(assignments).map(a => a.product))];
        
        // Collect all scripted capabilities
        const allScriptedCaps = [];
        Object.entries(assignments).forEach(([nodeName, assignment]) => {
            if (assignment.scriptedCapabilities.length > 0) {
                allScriptedCaps.push({
                    node: nodeName,
                    product: assignment.product,
                    capabilities: assignment.scriptedCapabilities
                });
            }
        });
        
        // Build edges by from-node for structure-aware rendering
        const nodeById = new Map();
        flow.nodes.forEach(n => { nodeById.set(n.id, n); });

        const edgesByFromNodeId = new Map();
        flow.edges.forEach(e => {
            if (!e.fromNodeId) return;
            if (!edgesByFromNodeId.has(e.fromNodeId)) {
                edgesByFromNodeId.set(e.fromNodeId, []);
            }
            edgesByFromNodeId.get(e.fromNodeId).push(e);
        });

        const sourceNode = flow.nodes.find(n => n.type === 'source');
        const diagramHtml = '<div class="migration-flow-row">' +
            (sourceNode
                ? this.renderMigrationSegment(sourceNode.id, flow, assignments, nodeMap, nodeById, edgesByFromNodeId)
                : '')
            + '</div>';
        
        // Build summary
        const summaryHtml = productsUsed.map(p => `
            <div class="migration-summary-item">
                <div class="product-dot"></div>
                <span>${p}</span>
            </div>
        `).join('');
        
        // Build scripted capabilities note if any
        let scriptedNoteHtml = '';
        if (allScriptedCaps.length > 0) {
            const scriptedDetails = allScriptedCaps.map(s => 
                `<span class="scripted-detail"><strong>${s.node}</strong> (${s.product}): ${s.capabilities.join(', ')}</span>`
            ).join('');
            
            scriptedNoteHtml = `
                <div class="migration-scripted-note">
                    <div class="scripted-note-header">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"></path>
                        </svg>
                        Scripted Capabilities Required:
                    </div>
                    <div class="scripted-note-content">${scriptedDetails}</div>
                </div>
            `;
        }
        
        // Determine badge style based on scripting
        const badgeClass = hasScripting ? 'migration-option-badge scripted' : 'migration-option-badge';
        const optionClass = hasScripting ? 'migration-option has-scripting' : 'migration-option';
        
        const optionId = `migration-option-${optionNumber}`;
        
        return `
            <div class="${optionClass}" id="${optionId}">
                <div class="migration-option-header">
                    <div class="migration-option-title">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Option ${optionNumber}${totalOptions > 1 ? ` of ${totalOptions}` : ''}
                        ${hasScripting ? '<span class="option-scripting-badge">+ Script</span>' : '<span class="option-native-badge">Native</span>'}
                    </div>
                    <div class="migration-option-actions">
                        <button class="migration-copy-btn" onclick="UIController.copyMigrationOptionAsPng('${optionId}')" title="Copy as PNG">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                            </svg>
                            Copy PNG
                        </button>
                        <div class="${badgeClass}">${productsUsed.length} product${productsUsed.length !== 1 ? 's' : ''}</div>
                    </div>
                </div>
                <div class="migration-diagram">
                    ${diagramHtml}
                </div>
                ${scriptedNoteHtml}
                <div class="migration-summary">
                    <div class="migration-summary-title">Products Used:</div>
                    <div class="migration-summary-list">
                        ${summaryHtml}
                    </div>
                </div>
            </div>
        `;
    },

    hideMigrationModal() {
        document.getElementById('migrationModal').classList.remove('visible');
    },

    async copyMigrationOptionAsPng(optionId) {
        const optionElement = document.getElementById(optionId);
        if (!optionElement) return;

        const copyBtn = optionElement.querySelector('.migration-copy-btn');
        const originalContent = copyBtn ? copyBtn.innerHTML : '';

        try {
            // Show loading state
            if (copyBtn) {
                copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning"><circle cx="12" cy="12" r="10"></circle></svg> Copying...`;
                copyBtn.disabled = true;
            }

            // Use html2canvas to capture the option
            const canvas = await html2canvas(optionElement, {
                backgroundColor: getComputedStyle(document.body).getPropertyValue('--bg-secondary').trim() || '#ffffff',
                scale: 2,
                logging: false,
                useCORS: true
            });

            // Convert to blob and copy to clipboard
            canvas.toBlob(async (blob) => {
                try {
                    await navigator.clipboard.write([
                        new ClipboardItem({ 'image/png': blob })
                    ]);
                    
                    // Show success feedback
                    if (copyBtn) {
                        copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Copied!`;
                        setTimeout(() => {
                            copyBtn.innerHTML = originalContent;
                            copyBtn.disabled = false;
                        }, 2000);
                    }
                } catch (err) {
                    console.error('Failed to copy to clipboard:', err);
                    if (copyBtn) {
                        copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Failed`;
                        setTimeout(() => {
                            copyBtn.innerHTML = originalContent;
                            copyBtn.disabled = false;
                        }, 2000);
                    }
                }
            }, 'image/png');
        } catch (err) {
            console.error('Failed to generate PNG:', err);
            if (copyBtn) {
                copyBtn.innerHTML = originalContent;
                copyBtn.disabled = false;
            }
        }
    },

    generateD2Code(nodes, connections) {
        const lines = [];
        
        // Add title
        lines.push('# MFT Flow Architecture');
        lines.push('');

        // Define node styles based on type
        const nodeStyles = {
            source: 'style.fill: "#e8f5e9"\nstyle.stroke: "#2e7d32"\nstyle.font-color: "#1b5e20"',
            intermediate: 'style.fill: "#e3f2fd"\nstyle.stroke: "#1565c0"\nstyle.font-color: "#0d47a1"',
            target: 'style.fill: "#fce4ec"\nstyle.stroke: "#c2185b"\nstyle.font-color: "#880e4f"'
        };

        // Helper to create safe D2 identifiers
        const safeId = (label) => {
            return label.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&');
        };

        // Declare nodes with their styles
        const nodeArray = Array.from(nodes.values());
        nodeArray.forEach(node => {
            const id = safeId(node.label);
            const style = nodeStyles[node.type] || nodeStyles.intermediate;
            lines.push(`${id}: "${node.label}" {`);
            lines.push(`  shape: rectangle`);
            style.split('\n').forEach(s => lines.push(`  ${s}`));
            lines.push(`}`);
            lines.push('');
        });

        // Add connections with protocol labels
        const connectionArray = Array.from(connections.values());
        connectionArray.forEach(conn => {
            const fromId = safeId(conn.from);
            const toId = safeId(conn.to);
            const label = `${conn.protocol} (${conn.direction})`;
            
            // Use different arrow styles based on direction
            const arrow = conn.direction === 'PUSH' ? '->' : '<-';
            lines.push(`${fromId} ${arrow} ${toId}: "${label}" {`);
            lines.push(`  style.stroke: "#546e7a"`);
            lines.push(`  style.font-size: 12`);
            lines.push(`}`);
        });

        // Add legend
        lines.push('');
        lines.push('legend: "Legend" {');
        lines.push('  Source: "Source" {');
        lines.push('    style.fill: "#e8f5e9"');
        lines.push('    style.stroke: "#2e7d32"');
        lines.push('  }');
        lines.push('  Intermediate: "MFT Hub" {');
        lines.push('    style.fill: "#e3f2fd"');
        lines.push('    style.stroke: "#1565c0"');
        lines.push('  }');
        lines.push('  Target: "Target" {');
        lines.push('    style.fill: "#fce4ec"');
        lines.push('    style.stroke: "#c2185b"');
        lines.push('  }');
        lines.push('}');

        return lines.join('\n');
    },

    encodeKrokiDiagram(source) {
        // Kroki uses zlib deflate + base64url encoding
        // pako.deflate (without raw:true) produces zlib format which is what Kroki expects
        const data = new TextEncoder().encode(source);
        const compressed = pako.deflate(data, { level: 9 });
        return this.base64UrlEncode(compressed);
    },

    base64UrlEncode(data) {
        // Convert Uint8Array to base64url
        let binary = '';
        for (let i = 0; i < data.length; i++) {
            binary += String.fromCharCode(data[i]);
        }
        const base64 = btoa(binary);
        // Convert to base64url
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },

    updateThemeIcon() {
        const icon = document.getElementById('themeIcon');
        if (StateManager.state.theme === 'dark') {
            icon.innerHTML = `
            <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
        `;
        } else {
            icon.innerHTML = `
            <circle cx="12" cy="12" r="5"></circle>
            <line x1="12" y1="1" x2="12" y2="3"></line>
            <line x1="12" y1="21" x2="12" y2="23"></line>
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
            <line x1="1" y1="12" x2="3" y2="12"></line>
            <line x1="21" y1="12" x2="23" y2="12"></line>
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
        `;
        }
    }
};

// ============================================
// ============================================
