const DiagramRenderer = {
    selectedFlowIndex: null,
    flows: [],

    render(flows, container) {
        container.innerHTML = '';
        this.flows = flows;

        if (!flows || flows.length === 0) {
            document.getElementById('emptyState').style.display = 'block';
            this.updateFlowSelector([]);
            this.updateRequiredProducts(null);
            this.updateNotesField(null);
            return;
        }

        document.getElementById('emptyState').style.display = 'none';

        flows.forEach((flow, flowIndex) => {
            const rowElement = this.createFlowRow(flow, flowIndex);
            container.appendChild(rowElement);
        });

        // Update flow selector
        this.updateFlowSelector(flows);

        // If no flow selected, select first one
        if (this.selectedFlowIndex === null && flows.length > 0) {
            this.selectFlow(0);
        } else if (this.selectedFlowIndex !== null) {
            this.selectFlow(this.selectedFlowIndex);
        }
    },

    updateFlowSelector(flows) {
        const selector = document.getElementById('flowSelector');
        if (!selector) return;

        selector.innerHTML = '<option value="">-- Select a flow --</option>';
        flows.forEach((flow, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `Flow ${index + 1}: ${flow.originalText.substring(0, 50)}${flow.originalText.length > 50 ? '...' : ''}`;
            selector.appendChild(option);
        });

        if (this.selectedFlowIndex !== null) {
            selector.value = this.selectedFlowIndex;
        }
    },

    selectFlow(flowIndex) {
        this.selectedFlowIndex = flowIndex;

        // Update UI
        const rows = document.querySelectorAll('.flow-row');
        rows.forEach((row, index) => {
            if (index === flowIndex) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
        });

        const selector = document.getElementById('flowSelector');
        if (selector) {
            selector.value = flowIndex;
        }

        // Update flow navigation items selection
        const flowNavItems = document.querySelectorAll('.flow-nav-item');
        flowNavItems.forEach((item, index) => {
            if (index === flowIndex) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });

        // Update notes and products for selected flow
        if (flowIndex !== null && this.flows[flowIndex]) {
            this.updateNotesField(flowIndex);
            this.updateRequiredProducts(flowIndex);
        } else {
            this.updateNotesField(null);
            this.updateRequiredProducts(null);
        }
    },

    updateRequiredProducts(flowIndex) {
        const productsList = document.getElementById('requiredProductsList');
        if (!productsList) return;

        if (flowIndex === null || !this.flows[flowIndex]) {
            productsList.innerHTML = '<div class="no-products-message">Select a flow to see potential products</div>';
            return;
        }

        const flow = this.flows[flowIndex];
        const requiredProducts = getRequiredProducts([flow]);

        if (requiredProducts.length === 0) {
            productsList.innerHTML = '<div class="no-products-message">No matching products found for the protocols used</div>';
            return;
        }

        // Get currently selected products for this flow
        const selectedProducts = StateManager.getSelectedProducts(flowIndex);

        productsList.innerHTML = requiredProducts.map(product => {
            const isSelected = selectedProducts.includes(product.name);
            const capabilitiesHtml = product.supportedCapabilities
                .map(cap => `<span class="capability-badge">${cap}</span>`)
                .join('');
            return `
            <div class="product-item${isSelected ? ' selected' : ''}" data-product="${product.name}" data-flow-index="${flowIndex}">
                <div class="product-header">
                    <input type="checkbox" class="product-checkbox" ${isSelected ? 'checked' : ''} data-product="${product.name}">
                    <div class="product-name">${product.name}</div>
                </div>
                <div class="product-capabilities">${capabilitiesHtml}</div>
            </div>
        `;
        }).join('');

        // Add event listeners for checkboxes
        productsList.querySelectorAll('.product-item').forEach(item => {
            const checkbox = item.querySelector('.product-checkbox');
            const productName = item.dataset.product;
            const flowIdx = parseInt(item.dataset.flowIndex);

            // Toggle on item click (but not on checkbox click to avoid double toggle)
            item.addEventListener('click', (e) => {
                if (e.target !== checkbox) {
                    checkbox.checked = !checkbox.checked;
                    this.toggleProductSelection(flowIdx, productName, checkbox.checked, item);
                }
            });

            // Handle checkbox change
            checkbox.addEventListener('change', (e) => {
                e.stopPropagation();
                this.toggleProductSelection(flowIdx, productName, checkbox.checked, item);
            });
        });
    },

    toggleProductSelection(flowIndex, productName, isSelected, itemElement) {
        StateManager.toggleSelectedProduct(flowIndex, productName, isSelected);
        
        // Update visual state
        if (isSelected) {
            itemElement.classList.add('selected');
        } else {
            itemElement.classList.remove('selected');
        }
        
        // Save to persistence
        Persistence.save();
    },

    updateNotesField(flowIndex) {
        const notesField = document.getElementById('generalNotesField');
        if (!notesField) return;

        if (flowIndex === null) {
            notesField.value = '';
            notesField.disabled = true;
        } else {
            notesField.value = StateManager.getFlowNotes(flowIndex);
            notesField.disabled = false;
        }
    },

    createFlowRow(flow, flowIndex) {
        const row = document.createElement('div');
        row.className = 'flow-row';
        if (flowIndex === this.selectedFlowIndex) {
            row.classList.add('selected');
        }

        // Make row clickable
        row.addEventListener('click', () => {
            this.selectFlow(flowIndex);
        });

        // Row header with number and copy button
        const rowHeader = document.createElement('div');
        rowHeader.className = 'flow-row-header';

        const rowNumber = document.createElement('div');
        rowNumber.className = 'flow-row-number';
        rowNumber.textContent = `Flow ${flowIndex + 1}`;

        const copyBtn = document.createElement('button');
        copyBtn.className = 'flow-copy-btn flow-action-btn';
        copyBtn.title = 'Copy flow as PNG';
        copyBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg><span class="flow-btn-label">Copy PNG</span>`;
        copyBtn.addEventListener('click', async (e) => {
            e.stopPropagation();
            await UIController.copyFlowAsPng(row, flowIndex);
        });

        const migrationBtn = document.createElement('button');
        migrationBtn.className = 'flow-copy-btn flow-migration-btn flow-action-btn';
        migrationBtn.title = 'Show Migration Options';
        migrationBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <path d="M12 18v-6"></path>
            <path d="M9 15l3 3 3-3"></path>
        </svg><span class="flow-btn-label">Migration</span>`;
        migrationBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            UIController.showMigrationOptions(flowIndex, flow);
        });

        rowHeader.appendChild(rowNumber);
        rowHeader.appendChild(copyBtn);
        rowHeader.appendChild(migrationBtn);
        row.appendChild(rowHeader);

        // Separate main flow and post-processing
        const mainFlowNodes = flow.nodes.filter(n => !n.isPostProcessing);
        const postProcessingNodes = flow.nodes.filter(n => n.isPostProcessing);
        const mainFlowEdges = flow.edges.filter(e => !e.isPostProcessing);
        const postProcessingEdges = flow.edges.filter(e => e.isPostProcessing);

        // Group main flow edges by their fromNodeId
        const mainEdgesByFromNodeId = new Map();
        mainFlowEdges.forEach((edge, idx) => {
            const key = edge.fromNodeId;
            // Only group edges that have valid node IDs
            if (key !== null && key !== undefined) {
                if (!mainEdgesByFromNodeId.has(key)) {
                    mainEdgesByFromNodeId.set(key, []);
                }
                mainEdgesByFromNodeId.get(key).push({ edge, edgeIndex: edge.index });
            }
        });

        // Track which edges and nodes we've rendered
        const renderedEdgeIndices = new Set();
        const renderedNodeIds = new Set();

        // Helper function to render main flow edges from a node
        const renderMainFlowEdgesFromNode = (nodeId) => {
            const edgesFromThisNode = mainEdgesByFromNodeId.get(nodeId) || [];
            // Filter out continuation edges - they should only be rendered in continuation chains, not in main flow
            const unrenderedEdges = edgesFromThisNode.filter(({ edge, edgeIndex }) => {
                if (renderedEdgeIndices.has(edgeIndex)) return false;
                // Exclude continuation edges from main flow rendering
                if (edge.isContinuation) return false;
                return true;
            });
            
            if (unrenderedEdges.length === 0) return;
            
            // Check if these are parallel outputs (different targets)
            const uniqueTargets = new Set(unrenderedEdges.map(({ edge }) => edge.toNodeId));
            const hasParallelOutputs = unrenderedEdges.some(({ edge }) => edge.isParallelOutput);
            
            if (hasParallelOutputs && uniqueTargets.size > 1) {
                // PARALLEL OUTPUTS: one source branching to multiple targets
                // All parallel output targets get rendered inline
                // Pass post-processing data so chains can continue from targets
                const parallelOutputContainer = this.createParallelOutputsElement(
                    unrenderedEdges, 
                    flowIndex, 
                    new Set(unrenderedEdges.map(({edge}) => edge.toLabel)),
                    postProcessingEdges,
                    postProcessingNodes,
                    renderedEdgeIndices,
                    renderedNodeIds,
                    mainFlowNodes,
                    mainEdgesByFromNodeId,
                    mainFlowEdges
                );
                row.appendChild(parallelOutputContainer);
                unrenderedEdges.forEach(({ edgeIndex }) => renderedEdgeIndices.add(edgeIndex));
                // Mark all parallel output target nodes as rendered
                unrenderedEdges.forEach(({ edge }) => {
                    const targetNode = mainFlowNodes.find(n => n.id === edge.toNodeId);
                    if (targetNode) renderedNodeIds.add(targetNode.id);
                });
            } else {
                // Group edges by their target
                const edgesByTarget = new Map();
                unrenderedEdges.forEach(({ edge, edgeIndex }) => {
                    const targetKey = edge.toNodeId;
                    if (!edgesByTarget.has(targetKey)) {
                        edgesByTarget.set(targetKey, []);
                    }
                    edgesByTarget.get(targetKey).push({ edge, edgeIndex });
                });

                edgesByTarget.forEach((targetEdges, targetNodeId) => {
                    if (targetEdges.length === 1) {
                        const { edge, edgeIndex } = targetEdges[0];
                        
                        const edgeElement = this.createEdgeElement(edge, flowIndex, edgeIndex);
                        row.appendChild(edgeElement);
                        renderedEdgeIndices.add(edgeIndex);
                        
                        // Render target node if not already rendered
                        if (!renderedNodeIds.has(targetNodeId)) {
                            const targetNode = mainFlowNodes.find(n => n.id === targetNodeId);
                            if (targetNode) {
                                const nodeElement = this.createNodeElement(targetNode);
                                row.appendChild(nodeElement);
                                renderedNodeIds.add(targetNode.id);
                                // Recursively render edges from this node
                                renderMainFlowEdgesFromNode(targetNode.id);
                            }
                        }
                    } else {
                        // Multiple edges to same target (parallel inputs)
                        const parallelContainer = this.createParallelEdgesElement(targetEdges, flowIndex);
                        row.appendChild(parallelContainer);
                        targetEdges.forEach(({ edgeIndex }) => renderedEdgeIndices.add(edgeIndex));
                        
                        // Render target node
                        if (!renderedNodeIds.has(targetNodeId)) {
                            const targetNode = mainFlowNodes.find(n => n.id === targetNodeId);
                            if (targetNode) {
                                const nodeElement = this.createNodeElement(targetNode);
                                row.appendChild(nodeElement);
                                renderedNodeIds.add(targetNode.id);
                                renderMainFlowEdgesFromNode(targetNode.id);
                            }
                        }
                    }
                });
            }
        };
        
        // Render main flow nodes and edges
        mainFlowNodes.forEach((node, nodeIndex) => {
            // Skip if already rendered
            if (renderedNodeIds.has(node.id)) {
                return;
            }

            // Add "Before Source" description field before the first node (source)
            if (nodeIndex === 0 && node.type === 'source') {
                const beforeSourceField = this.createDescriptionField(flowIndex, 'beforeSource', 'Before Source');
                row.appendChild(beforeSourceField);
            }

            // Add node
            const nodeElement = this.createNodeElement(node);
            row.appendChild(nodeElement);
            renderedNodeIds.add(node.id);

            // Render edges from this node
            renderMainFlowEdgesFromNode(node.id);
        });
        
        // Now render post-processing chain (as a separate visual sequence)
        // BUT: Skip edges that start from bridge nodes (they're rendered inline with parallel outputs)
        if (postProcessingEdges.length > 0) {
            // Group post-processing edges by fromNodeId
            const ppEdgesByFromNodeId = new Map();
            postProcessingEdges.forEach((edge) => {
                const key = edge.fromNodeId;
                if (!ppEdgesByFromNodeId.has(key)) {
                    ppEdgesByFromNodeId.set(key, []);
                }
                ppEdgesByFromNodeId.get(key).push({ edge, edgeIndex: edge.index });
            });
            
            // Find bridge nodes (main flow nodes that have post-processing edges)
            const bridgeNodeIds = new Set();
            mainFlowNodes.forEach((node) => {
                if (ppEdgesByFromNodeId.has(node.id)) {
                    bridgeNodeIds.add(node.id);
                }
            });
            
            // Render remaining post-processing nodes and their edges
            // Skip nodes that are bridge nodes (they're already rendered in main flow)
            postProcessingNodes.forEach((node, nodeIndex) => {
                // Skip if this is a bridge node (already rendered in main flow)
                if (bridgeNodeIds.has(node.id)) return;
                
                // Add node if not already rendered
                if (!renderedNodeIds.has(node.id)) {
                    const nodeElement = this.createNodeElement(node);
                    row.appendChild(nodeElement);
                    renderedNodeIds.add(node.id);
                }
                
                // Render edges from this node
                const edgesFromNode = ppEdgesByFromNodeId.get(node.id) || [];
                edgesFromNode.forEach(({ edge, edgeIndex }) => {
                    if (renderedEdgeIndices.has(edgeIndex)) return;
                    
                    const edgeElement = this.createEdgeElement(edge, flowIndex, edgeIndex);
                    row.appendChild(edgeElement);
                    renderedEdgeIndices.add(edgeIndex);
                    
                    // Render target node if not already rendered
                    const targetNode = postProcessingNodes.find(n => n.id === edge.toNodeId);
                    if (targetNode && !renderedNodeIds.has(targetNode.id) && !bridgeNodeIds.has(targetNode.id)) {
                        const targetNodeElement = this.createNodeElement(targetNode);
                        row.appendChild(targetNodeElement);
                        renderedNodeIds.add(targetNode.id);
                    }
                });
            });
            
            // Add "After Target" field after the last post-processing node
            const lastPPNode = postProcessingNodes.find(n => n.type === 'target' && !bridgeNodeIds.has(n.id));
            if (lastPPNode) {
                const afterTargetField = this.createDescriptionField(flowIndex, 'afterTarget', 'After Target');
                row.appendChild(afterTargetField);
            }
        } else {
            // Add "After Target" field for main flow if no post-processing
            const lastMainNode = mainFlowNodes.find(n => n.type === 'target');
            if (lastMainNode) {
                const afterTargetField = this.createDescriptionField(flowIndex, 'afterTarget', 'After Target');
                row.appendChild(afterTargetField);
            }
        }

        return row;
    },

    createPostProcessingSeparator() {
        const separator = document.createElement('div');
        separator.className = 'post-processing-separator';
        
        const symbol = document.createElement('span');
        symbol.className = 'post-processing-separator-symbol';
        symbol.textContent = '>>';
        symbol.title = 'Post-processing chain (triggered after completion)';
        
        separator.appendChild(symbol);
        return separator;
    },

    createParallelEdgesElement(edges, flowIndex) {
        const container = document.createElement('div');
        container.className = 'flow-edge parallel-edges';

        // Create stacked arrows - each step gets its own arrow line with its own text fields
        const arrowsStack = document.createElement('div');
        arrowsStack.className = 'parallel-arrows-stack';

        edges.forEach(({ edge, edgeIndex }) => {
            const stepPrefix = edge.stepNumber ? `${edge.stepNumber}: ` : '';
            const displayCapability = `${stepPrefix}${edge.protocol} ${edge.direction}`;

            // Create a row for this step with label + arrow + text fields
            const stepRow = document.createElement('div');
            stepRow.className = 'parallel-step-row';

            // Protocol label
            const protocolLabel = document.createElement('div');
            protocolLabel.className = 'edge-protocol parallel-step';
            protocolLabel.textContent = displayCapability;

            // Arrow line
            const lineContainer = document.createElement('div');
            lineContainer.className = 'edge-line-container';

            if (edge.flowDirection === 'reverse') {
                const arrowStart = document.createElement('div');
                arrowStart.className = 'edge-arrow reverse';
                lineContainer.appendChild(arrowStart);
            }

            const line = document.createElement('div');
            line.className = 'edge-line';
            lineContainer.appendChild(line);

            if (edge.flowDirection === 'forward') {
                const arrowEnd = document.createElement('div');
                arrowEnd.className = 'edge-arrow';
                lineContainer.appendChild(arrowEnd);
            }

            // Text fields for this specific edge
            const edgeTextFields = document.createElement('div');
            edgeTextFields.className = 'parallel-step-text-fields';

            // PRE-PROCESSING
            const preContainer = document.createElement('div');
            preContainer.className = 'edge-notes-container';
            const preLabel = document.createElement('div');
            preLabel.className = 'edge-notes-label';
            preLabel.textContent = 'PRE-PROCESSING';
            const preInput = document.createElement('input');
            preInput.type = 'text';
            preInput.className = 'edge-notes-input';
            preInput.placeholder = 'Add notes...';
            preInput.value = StateManager.getAnnotation(flowIndex, edgeIndex, 'pre') || '';
            preInput.addEventListener('click', (e) => e.stopPropagation());
            preInput.addEventListener('input', debounce(() => {
                StateManager.updateAnnotation(flowIndex, edgeIndex, 'pre', preInput.value);
                Persistence.save();
            }, 300));
            preContainer.appendChild(preLabel);
            preContainer.appendChild(preInput);

            // POST-PROCESSING
            const postContainer = document.createElement('div');
            postContainer.className = 'edge-notes-container';
            const postLabel = document.createElement('div');
            postLabel.className = 'edge-notes-label';
            postLabel.textContent = 'POST-PROCESSING';
            const postInput = document.createElement('input');
            postInput.type = 'text';
            postInput.className = 'edge-notes-input';
            postInput.placeholder = 'Add notes...';
            postInput.value = StateManager.getAnnotation(flowIndex, edgeIndex, 'post') || '';
            postInput.addEventListener('click', (e) => e.stopPropagation());
            postInput.addEventListener('input', debounce(() => {
                StateManager.updateAnnotation(flowIndex, edgeIndex, 'post', postInput.value);
                Persistence.save();
            }, 300));
            postContainer.appendChild(postLabel);
            postContainer.appendChild(postInput);

            edgeTextFields.appendChild(preContainer);
            edgeTextFields.appendChild(postContainer);

            stepRow.appendChild(protocolLabel);
            stepRow.appendChild(lineContainer);
            stepRow.appendChild(edgeTextFields);
            arrowsStack.appendChild(stepRow);
        });

        container.appendChild(arrowsStack);

        return container;
    },

    createParallelOutputsElement(edges, flowIndex, inlineTargets = new Set(), ppEdges = [], ppNodes = [], renderedEdgeIndices = new Set(), renderedNodeIds = new Set(), mainFlowNodes = [], mainEdgesByFromNodeId = new Map(), mainFlowEdges = []) {
        // Container for branching outputs (one source to multiple targets)
        const container = document.createElement('div');
        container.className = 'parallel-outputs-container';

        // Group post-processing edges by fromNodeId for easy lookup
        const ppEdgesByFromNodeId = new Map();
        ppEdges.forEach((edge) => {
            const key = edge.fromNodeId;
            if (!ppEdgesByFromNodeId.has(key)) {
                ppEdgesByFromNodeId.set(key, []);
            }
            ppEdgesByFromNodeId.get(key).push({ edge, edgeIndex: edge.index });
        });

        // Create each branch (arrow + target node + optional post-processing chain)
        edges.forEach(({ edge, edgeIndex }) => {
            const branchRow = document.createElement('div');
            branchRow.className = 'parallel-output-branch';

            // Create the edge element with text fields
            const edgeContainer = document.createElement('div');
            edgeContainer.className = 'flow-edge';

            const stepPrefix = edge.stepNumber ? `${edge.stepNumber}: ` : '';
            const displayCapability = `${stepPrefix}${edge.protocol} ${edge.direction}`;

            // Protocol label
            const protocolLabel = document.createElement('div');
            protocolLabel.className = 'edge-protocol parallel-step';
            protocolLabel.textContent = displayCapability;

            // Line container with arrow
            const lineContainer = document.createElement('div');
            lineContainer.className = 'edge-line-container';

            if (edge.flowDirection === 'reverse') {
                const arrowStart = document.createElement('div');
                arrowStart.className = 'edge-arrow reverse';
                lineContainer.appendChild(arrowStart);
            }

            const line = document.createElement('div');
            line.className = 'edge-line';
            lineContainer.appendChild(line);

            if (edge.flowDirection === 'forward' || !edge.flowDirection) {
                const arrowEnd = document.createElement('div');
                arrowEnd.className = 'edge-arrow';
                lineContainer.appendChild(arrowEnd);
            }

            edgeContainer.appendChild(protocolLabel);
            edgeContainer.appendChild(lineContainer);

            // Add PRE/POST processing fields for this edge
            const edgeTextFields = document.createElement('div');
            edgeTextFields.className = 'edge-text-fields';

            // PRE-PROCESSING
            const preContainer = document.createElement('div');
            preContainer.className = 'edge-notes-container';
            const preLabel = document.createElement('div');
            preLabel.className = 'edge-notes-label';
            preLabel.textContent = 'PRE-PROCESSING';
            const preInput = document.createElement('input');
            preInput.type = 'text';
            preInput.className = 'edge-notes-input';
            preInput.placeholder = 'Add notes...';
            preInput.value = StateManager.getAnnotation(flowIndex, edgeIndex, 'pre') || '';
            preInput.addEventListener('click', (e) => e.stopPropagation());
            preInput.addEventListener('input', debounce(() => {
                StateManager.updateAnnotation(flowIndex, edgeIndex, 'pre', preInput.value);
                Persistence.save();
            }, 300));
            preContainer.appendChild(preLabel);
            preContainer.appendChild(preInput);

            // POST-PROCESSING
            const postContainer = document.createElement('div');
            postContainer.className = 'edge-notes-container';
            const postLabel = document.createElement('div');
            postLabel.className = 'edge-notes-label';
            postLabel.textContent = 'POST-PROCESSING';
            const postInput = document.createElement('input');
            postInput.type = 'text';
            postInput.className = 'edge-notes-input';
            postInput.placeholder = 'Add notes...';
            postInput.value = StateManager.getAnnotation(flowIndex, edgeIndex, 'post') || '';
            postInput.addEventListener('click', (e) => e.stopPropagation());
            postInput.addEventListener('input', debounce(() => {
                StateManager.updateAnnotation(flowIndex, edgeIndex, 'post', postInput.value);
                Persistence.save();
            }, 300));
            postContainer.appendChild(postLabel);
            postContainer.appendChild(postInput);

            edgeTextFields.appendChild(preContainer);
            edgeTextFields.appendChild(postContainer);
            edgeContainer.appendChild(edgeTextFields);

            branchRow.appendChild(edgeContainer);

            // Render target node inline for parallel outputs
            const targetNodeElement = document.createElement('div');
            targetNodeElement.className = 'flow-node';
            
            // Check if this target has continuation edges (main flow edges continuing the chain)
            // Only pick continuation edges that belong to THIS parallel output branch (same stepNumber)
            const currentParallelStep = edge.stepNumber; // The step number of the parallel output we're rendering
            
            // Find edges from this target node by node ID only
            let edgesFromTarget = mainEdgesByFromNodeId.get(edge.toNodeId) || [];
            
            const continuationEdges = edgesFromTarget
                .filter(({ edge: contEdge, edgeIndex }) => {
                    // Only include continuation edges that:
                    // 1. Haven't been rendered yet
                    // 2. Are marked as continuation
                    // 3. Belong to this parallel output step
                    if (renderedEdgeIndices.has(edgeIndex)) return false;
                    if (!contEdge.isContinuation) return false; // Only continuation edges
                    if (contEdge.parallelOutputStepNumber === null) return false; // Must have step number
                    return contEdge.parallelOutputStepNumber === currentParallelStep;
                });
            const hasContinuation = continuationEdges.length > 0;
            
            // Also check for post-processing edges (bridge node)
            const ppEdgesFromTarget = ppEdgesByFromNodeId.get(edge.toNodeId) || [];
            const hasPPChain = ppEdgesFromTarget.length > 0;
            
            const nodeBox = document.createElement('div');
            nodeBox.className = (hasContinuation || hasPPChain) ? 'node-box intermediate' : 'node-box target';
            nodeBox.textContent = edge.toLabel;
            
            const nodeType = document.createElement('div');
            nodeType.className = 'node-type';
            nodeType.textContent = (hasContinuation || hasPPChain) ? 'INTERMEDIATE' : 'TARGET';
            
            targetNodeElement.appendChild(nodeBox);
            targetNodeElement.appendChild(nodeType);
            branchRow.appendChild(targetNodeElement);

            // If this target has continuation edges, render them inline
            if (hasContinuation) {
                // Create a wrapper for continuation chain that aligns with the target node (center)
                const continuationWrapper = document.createElement('div');
                continuationWrapper.className = 'continuation-wrapper';
                continuationWrapper.style.display = 'flex';
                continuationWrapper.style.alignItems = 'center';
                continuationWrapper.style.gap = '0';
                
                // Render continuation chain inline (main flow)
                // Pass a new Set to track nodes rendered in this continuation chain
                this.renderContinuationChainInline(continuationWrapper, continuationEdges, mainFlowNodes, mainEdgesByFromNodeId, flowIndex, renderedEdgeIndices, renderedNodeIds, mainFlowEdges, new Set());
                branchRow.appendChild(continuationWrapper);
            } else if (hasPPChain) {
                // Render the post-processing chain inline
                this.renderPPChainInline(branchRow, ppEdgesFromTarget, ppNodes, ppEdgesByFromNodeId, flowIndex, renderedEdgeIndices, renderedNodeIds, mainFlowNodes);
            } else {
                // No continuation - show After Target field
                const afterTargetField = document.createElement('div');
                afterTargetField.className = 'flow-description-field after-target';
                
                const afterTargetLabel = document.createElement('div');
                afterTargetLabel.className = 'flow-description-label';
                afterTargetLabel.textContent = 'After Target';
                
                const afterTargetTextarea = document.createElement('textarea');
                afterTargetTextarea.className = 'flow-description-input';
                afterTargetTextarea.placeholder = 'Describe post-target steps...';
                afterTargetTextarea.value = StateManager.getFlowDescription(flowIndex, `afterTarget-${edge.toLabel}`) || '';
                afterTargetTextarea.addEventListener('click', (e) => e.stopPropagation());
                afterTargetTextarea.addEventListener('input', debounce(() => {
                    StateManager.updateFlowDescription(flowIndex, `afterTarget-${edge.toLabel}`, afterTargetTextarea.value);
                    Persistence.save();
                }, 300));
                
                afterTargetField.appendChild(afterTargetLabel);
                afterTargetField.appendChild(afterTargetTextarea);
                branchRow.appendChild(afterTargetField);
            }
            
            container.appendChild(branchRow);
        });

        return container;
    },

    renderContinuationChainInline(container, startingEdges, mainFlowNodes, mainEdgesByFromNodeId, flowIndex, renderedEdgeIndices, renderedNodeIds, mainFlowEdges = [], continuationRenderedNodes = new Set()) {
        // Recursively render continuation chain inline (main flow)
        // continuationRenderedNodes tracks nodes rendered specifically in this continuation chain
        // to avoid duplicates within the continuation while allowing nodes that appeared earlier
        startingEdges.forEach(({ edge, edgeIndex }) => {
            if (renderedEdgeIndices.has(edgeIndex)) return;
            
            // Create edge element (regular main flow style)
            const edgeElement = this.createEdgeElement(edge, flowIndex, edgeIndex);
            container.appendChild(edgeElement);
            renderedEdgeIndices.add(edgeIndex);
            
            // Find target node by ID only
            let targetNode = mainFlowNodes.find(n => n.id === edge.toNodeId);
            
            if (targetNode) {
                // Stop continuation chain IMMEDIATELY if this is a target node
                // This prevents rendering edges after the final target
                if (targetNode.type === 'target') {
                    // Render the node if it hasn't been rendered in THIS continuation chain
                    if (!continuationRenderedNodes.has(targetNode.id)) {
                        const nodeElement = this.createNodeElement(targetNode);
                        container.appendChild(nodeElement);
                        continuationRenderedNodes.add(targetNode.id);
                        // Also mark in main renderedNodeIds to prevent infinite loops
                        if (!renderedNodeIds.has(targetNode.id)) {
                            renderedNodeIds.add(targetNode.id);
                        }
                        // Add After Target field with unique key for continuation chain
                        const uniqueKey = `afterTarget-continuation-${edge.parallelOutputStepNumber}-${targetNode.id}`;
                        const afterTargetField = this.createDescriptionField(flowIndex, 'afterTarget', 'After Target', uniqueKey);
                        container.appendChild(afterTargetField);
                    }
                    // ALWAYS stop here if it's a target node - don't look for or render any more edges
                    // Mark ALL edges FROM this target node as rendered to prevent them from being rendered elsewhere
                    // This prevents any edges from appearing after a target node
                    const remainingEdgesFromTarget = mainEdgesByFromNodeId.get(targetNode.id) || [];
                    remainingEdgesFromTarget.forEach(({ edge: remainingEdge, edgeIndex }) => {
                        // Mark ALL edges from target nodes as rendered, regardless of type
                        if (!renderedEdgeIndices.has(edgeIndex)) {
                            renderedEdgeIndices.add(edgeIndex);
                        }
                    });
                    return;
                }
                
                // For non-target nodes, render the node if it hasn't been rendered in THIS continuation chain
                // This allows nodes that appeared earlier in the main flow to appear again in continuations
                if (!continuationRenderedNodes.has(targetNode.id)) {
                    const nodeElement = this.createNodeElement(targetNode);
                    container.appendChild(nodeElement);
                    continuationRenderedNodes.add(targetNode.id);
                    // Also mark in main renderedNodeIds to prevent infinite loops
                    if (!renderedNodeIds.has(targetNode.id)) {
                        renderedNodeIds.add(targetNode.id);
                    }
                }
                
                // Always check for continuation edges, even if the node was already rendered
                // Only follow continuation edges that match the same parallel output step
                const currentContinuationStep = edge.parallelOutputStepNumber;
                
                // IMPORTANT: Don't look for edges FROM target nodes - they should never have outgoing edges
                // This is a safety check in case the target node check above didn't catch it
                if (targetNode.type === 'target') {
                    // This shouldn't happen since we check above, but add safety check
                    const uniqueKey = `afterTarget-continuation-${edge.parallelOutputStepNumber}-${targetNode.id}`;
                    const afterTargetField = this.createDescriptionField(flowIndex, 'afterTarget', 'After Target', uniqueKey);
                    container.appendChild(afterTargetField);
                    return;
                }
                
                // Find edges from this target node by node ID only
                let nextEdgesFromNode = mainEdgesByFromNodeId.get(targetNode.id) || [];
                
                const nextEdges = nextEdgesFromNode
                    .filter(({ edge: nextEdge, edgeIndex }) => {
                        if (renderedEdgeIndices.has(edgeIndex)) return false;
                        // Only follow continuation edges from the same parallel output branch
                        if (!nextEdge.isContinuation) return false;
                        if (nextEdge.parallelOutputStepNumber === null) return false;
                        if (nextEdge.parallelOutputStepNumber !== currentContinuationStep) return false;
                        
                        return true;
                    });
                
                // Only continue if there are continuation edges and this is not a target node
                if (nextEdges.length > 0) {
                    this.renderContinuationChainInline(container, nextEdges, mainFlowNodes, mainEdgesByFromNodeId, flowIndex, renderedEdgeIndices, renderedNodeIds, mainFlowEdges, continuationRenderedNodes);
                } else {
                    // No more continuation edges - add After Target field if this is the last node in the chain
                    // Use unique key for continuation chain
                    const uniqueKey = `afterTarget-continuation-${currentContinuationStep}-${targetNode.id}`;
                    const afterTargetField = this.createDescriptionField(flowIndex, 'afterTarget', 'After Target', uniqueKey);
                    container.appendChild(afterTargetField);
                }
            }
        });
    },

    renderPPChainInline(container, startingEdges, ppNodes, ppEdgesByFromNodeId, flowIndex, renderedEdgeIndices, renderedNodeIds, mainFlowNodes = []) {
        // Recursively render post-processing chain inline
        startingEdges.forEach(({ edge, edgeIndex }) => {
            if (renderedEdgeIndices.has(edgeIndex)) return;
            
            // Create edge element (green post-processing style)
            const edgeElement = this.createEdgeElement(edge, flowIndex, edgeIndex);
            container.appendChild(edgeElement);
            renderedEdgeIndices.add(edgeIndex);
            
            // Find target node (could be in ppNodes or mainFlowNodes if it's a bridge)
            let targetNode = ppNodes.find(n => n.id === edge.toNodeId);
            if (!targetNode) {
                targetNode = mainFlowNodes.find(n => n.id === edge.toNodeId);
            }
            
            if (targetNode && !renderedNodeIds.has(targetNode.id)) {
                const nodeElement = this.createNodeElement(targetNode);
                container.appendChild(nodeElement);
                renderedNodeIds.add(targetNode.id);
                
                // Check if this node has more PP edges
                const nextEdges = ppEdgesByFromNodeId.get(targetNode.id) || [];
                if (nextEdges.length > 0) {
                    this.renderPPChainInline(container, nextEdges, ppNodes, ppEdgesByFromNodeId, flowIndex, renderedEdgeIndices, renderedNodeIds, mainFlowNodes);
                } else if (targetNode.type === 'target') {
                    // This is the final node - add After Target field
                    const afterTargetField = this.createDescriptionField(flowIndex, 'afterTarget', 'After Target');
                    container.appendChild(afterTargetField);
                }
            }
        });
    },

    createDescriptionField(flowIndex, type, label, uniqueKey = null) {
        const container = document.createElement('div');
        container.className = `flow-description-field ${type === 'beforeSource' ? 'before-source' : 'after-target'}`;

        const labelElement = document.createElement('div');
        labelElement.className = 'flow-description-label';
        labelElement.textContent = label;

        const textarea = document.createElement('textarea');
        textarea.className = 'flow-description-input';
        textarea.placeholder = type === 'beforeSource'
            ? 'Describe pre-source steps...'
            : 'Describe post-target steps...';
        
        // Use unique key if provided, otherwise use type
        const storageKey = uniqueKey || type;
        textarea.value = StateManager.getFlowDescription(flowIndex, storageKey);

        // Debounced save
        let saveTimeout;
        textarea.addEventListener('input', () => {
            clearTimeout(saveTimeout);
            saveTimeout = setTimeout(() => {
                StateManager.updateFlowDescription(flowIndex, storageKey, textarea.value);
                Persistence.save();
            }, 300);
        });

        // Stop propagation to prevent row selection when typing
        textarea.addEventListener('click', (e) => e.stopPropagation());

        container.appendChild(labelElement);
        container.appendChild(textarea);

        return container;
    },

    createNodeElement(node) {
        const container = document.createElement('div');
        container.className = 'flow-node';

        const box = document.createElement('div');
        box.className = `node-box ${node.type}`;
        box.textContent = node.label;

        const typeLabel = document.createElement('div');
        typeLabel.className = 'node-type';
        typeLabel.textContent = node.type;

        container.appendChild(box);
        container.appendChild(typeLabel);

        return container;
    },

    createEdgeElement(edge, flowIndex, edgeIndex) {
        const container = document.createElement('div');
        container.className = 'flow-edge' + (edge.isPostProcessing ? ' post-processing-edge' : '');

        // Check if protocol+direction is valid
        const currentCapability = `${edge.protocol} ${edge.direction}`;
        // Build display text with step number if present
        const stepPrefix = edge.stepNumber ? `${edge.stepNumber}: ` : '';
        const displayCapability = `${stepPrefix}${edge.protocol} ${edge.direction}`;
        
        // Ensure functions are available (defensive check)
        // If function doesn't exist, default to invalid (show dropdown) to be safe
        let isValid = false;
        if (typeof isValidCapability === 'function') {
            try {
                isValid = isValidCapability(edge.protocol, edge.direction);
            } catch (e) {
                console.error('Error checking capability validity:', e);
                isValid = false; // Default to invalid on error
            }
        } else {
            console.warn('isValidCapability function not found - treating all as potentially invalid');
            // Default to showing dropdown if function not available
            isValid = false;
        }

        // Protocol label or select dropdown
        let protocolElement;
        if (!isValid) {
            // Create select dropdown for invalid capabilities
            protocolElement = document.createElement('select');
            protocolElement.className = 'edge-protocol-select';
            protocolElement.title = 'Unknown capability - select a valid one';

            // Get all available capabilities
            const allCapabilities = getAllAvailableCapabilities();

            // Add current (invalid) value as first option
            const currentOption = document.createElement('option');
            currentOption.value = currentCapability;
            currentOption.textContent = `${displayCapability} ⚠`;
            currentOption.selected = true;
            protocolElement.appendChild(currentOption);

            // Add separator
            const separator = document.createElement('option');
            separator.disabled = true;
            separator.textContent = '──────────';
            protocolElement.appendChild(separator);

            // Add all valid capabilities
            allCapabilities.forEach(cap => {
                const option = document.createElement('option');
                option.value = cap;
                option.textContent = cap;
                protocolElement.appendChild(option);
            });

            // Handle change event
            protocolElement.addEventListener('change', (e) => {
                const newCapability = e.target.value;
                if (newCapability && newCapability !== currentCapability) {
                    this.updateProtocolInPattern(flowIndex, edgeIndex, edge.protocol, edge.direction, newCapability);
                }
            });
        } else {
            // Create regular div for valid capabilities
            protocolElement = document.createElement('div');
            protocolElement.className = 'edge-protocol';
            protocolElement.textContent = displayCapability;
        }

        // Line container
        const lineContainer = document.createElement('div');
        lineContainer.className = 'edge-line-container';

        // Arrow at start if reverse
        if (edge.flowDirection === 'reverse') {
            const arrowStart = document.createElement('div');
            arrowStart.className = 'edge-arrow reverse';
            lineContainer.appendChild(arrowStart);
        }

        // Line
        const line = document.createElement('div');
        line.className = 'edge-line';
        lineContainer.appendChild(line);

        // Arrow at end if forward
        if (edge.flowDirection === 'forward') {
            const arrowEnd = document.createElement('div');
            arrowEnd.className = 'edge-arrow';
            lineContainer.appendChild(arrowEnd);
        }

        // Annotations container
        const annotations = document.createElement('div');
        annotations.className = 'edge-annotations';

        // Pre-processing annotation
        const preLabel = document.createElement('div');
        preLabel.className = 'annotation-label';
        preLabel.textContent = 'Pre-Processing';

        const preInput = document.createElement('input');
        preInput.type = 'text';
        preInput.className = 'annotation-input';
        preInput.placeholder = 'Add notes...';
        preInput.value = StateManager.getAnnotation(flowIndex, edgeIndex, 'pre');
        preInput.addEventListener('input', debounce((e) => {
            StateManager.updateAnnotation(flowIndex, edgeIndex, 'pre', e.target.value);
            this.triggerSave();
        }, 300));

        // Post-processing annotation
        const postLabel = document.createElement('div');
        postLabel.className = 'annotation-label';
        postLabel.textContent = 'Post-Processing';

        const postInput = document.createElement('input');
        postInput.type = 'text';
        postInput.className = 'annotation-input';
        postInput.placeholder = 'Add notes...';
        postInput.value = StateManager.getAnnotation(flowIndex, edgeIndex, 'post');
        postInput.addEventListener('input', debounce((e) => {
            StateManager.updateAnnotation(flowIndex, edgeIndex, 'post', e.target.value);
            this.triggerSave();
        }, 300));

        annotations.appendChild(preLabel);
        annotations.appendChild(preInput);
        annotations.appendChild(postLabel);
        annotations.appendChild(postInput);

        container.appendChild(protocolElement);
        container.appendChild(lineContainer);
        container.appendChild(annotations);

        return container;
    },

    updateProtocolInPattern(flowIndex, edgeIndex, oldProtocol, oldDirection, newCapability) {
        // Parse new capability to get protocol and direction
        const parts = newCapability.split(' ');
        if (parts.length < 2) return;

        const newDirection = parts[parts.length - 1];
        const newProtocol = parts.slice(0, -1).join(' ');

        // Get current pattern text
        const patternText = UIController.elements.patternEditor.value;
        const lines = patternText.split('\n');

        // Find the flow's line
        const result = Parser.parseMultiple(patternText);
        if (!result.flows || flowIndex >= result.flows.length) return;

        // Find which line contains this flow
        let flowLineIndex = -1;
        let currentFlowIndex = 0;
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line || line.startsWith('//')) continue;

            const lineResult = Parser.parseMultiple(line);
            if (lineResult.flows && lineResult.flows.length > 0) {
                if (currentFlowIndex === flowIndex) {
                    flowLineIndex = i;
                    break;
                }
                currentFlowIndex++;
            }
        }

        if (flowLineIndex === -1) return;

        // Parse the line to get segments
        const line = lines[flowLineIndex];
        const parseResult = Parser.parseMultiple(line);
        if (!parseResult.flows || parseResult.flows.length === 0) return;

        const flow = parseResult.flows[0];
        if (!flow.edges || edgeIndex >= flow.edges.length) return;

        // Rebuild the line by replacing the specific edge's protocol+direction
        const entities = flow.nodes.map(n => n.label);
        const edges = flow.edges;

        // Rebuild the line string: Entity -> Protocol Direction -> Entity <- Protocol Direction <- Entity
        const newLineParts = [entities[0]];

        for (let i = 0; i < edges.length; i++) {
            const edge = edges[i];
            const arrow = edge.flowDirection === 'reverse' ? '<-' : '->';
            const protocol = (i === edgeIndex) ? newProtocol : edge.protocol;
            const direction = (i === edgeIndex) ? newDirection : edge.direction;

            newLineParts.push(arrow);
            newLineParts.push(`${protocol} ${direction}`);
            newLineParts.push(arrow);
            newLineParts.push(entities[i + 1]);
        }

        const newLine = newLineParts.join(' ');

        // Update the pattern text
        lines[flowLineIndex] = newLine;
        const updatedPattern = lines.join('\n');

        // Update the editor and trigger re-render
        UIController.elements.patternEditor.value = updatedPattern;
        UIController.updatePattern();
        UIController.setSaveIndicator('saving');
        Persistence.save();
        setTimeout(() => UIController.setSaveIndicator('saved'), 500);
    },

    triggerSave() {
        UIController.setSaveIndicator('saving');
        Persistence.save();
        setTimeout(() => UIController.setSaveIndicator('saved'), 500);
    }
};

// Make debounce available to DiagramRenderer
DiagramRenderer.debounce = debounce;

// ============================================
