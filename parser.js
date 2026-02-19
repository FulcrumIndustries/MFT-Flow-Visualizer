const Parser = {
    parseMultiple(text) {
        const lines = text.split('\n').filter(line => line.trim());
        const results = [];
        const errors = [];

        lines.forEach((line, index) => {
            const result = this.parseLine(line.trim(), index + 1);
            if (result.error) {
                errors.push({ line: index + 1, message: result.error });
            } else if (result.nodes.length > 0) {
                results.push({
                    lineNumber: index + 1,
                    originalText: line.trim(),
                    nodes: result.nodes,
                    edges: result.edges
                });
            }
        });

        return { flows: results, errors };
    },

    parseLine(text, lineNumber) {
        const result = {
            nodes: [],
            edges: [],
            error: null
        };

        if (!text || !text.trim()) {
            return result;
        }

        const trimmed = text.trim();

        // Tokenize the pattern
        const tokens = this.tokenize(trimmed);

        if (tokens.error) {
            result.error = tokens.error;
            return result;
        }

        // Build nodes and edges from tokens
        const { nodes, edges, error } = this.buildGraph(tokens.segments);

        if (error) {
            result.error = error;
            return result;
        }

        result.nodes = nodes;
        result.edges = edges;

        return result;
    },

    tokenize(text) {
        // Parse the flow pattern
        const result = this.tokenizeChain(text);
        if (result.error) {
            return result;
        }

        return { 
            segments: result.segments
        };
    },

    tokenizeChain(text) {
        const segments = [];

        // Protect content inside parentheses from arrow splitting
        // Replace parenthesized content with placeholders
        const placeholders = [];
        let protectedText = text.replace(/\([^)]+\)/g, (match) => {
            const idx = placeholders.length;
            placeholders.push(match);
            return `__PARALLEL_${idx}__`;
        });

        // Split by arrows while keeping track of direction
        const arrowPattern = /(<-|->)/g;
        const parts = protectedText.split(arrowPattern).map(p => p.trim()).filter(p => p);
        
        // Restore placeholders
        const restoredParts = parts.map(p => {
            return p.replace(/__PARALLEL_(\d+)__/g, (match, idx) => placeholders[parseInt(idx)]);
        });

        if (restoredParts.length < 5) {
            return { error: 'Invalid pattern. Expected: Entity -> PROTOCOL DIRECTION -> Entity' };
        }

        let currentIndex = 0;

        // First entity - accept any string (no validation)
        const firstEntity = restoredParts[currentIndex];
        segments.push({ type: 'entity', value: firstEntity });
        currentIndex++;

        while (currentIndex < restoredParts.length) {
            // Expect arrow
            const arrow1 = restoredParts[currentIndex];
            if (arrow1 !== '<-' && arrow1 !== '->') {
                return { error: `Expected arrow (<- or ->), got: "${arrow1}"` };
            }
            currentIndex++;

            // Expect PROTOCOL DIRECTION or parallel syntax
            if (currentIndex >= restoredParts.length) {
                return { error: 'Unexpected end of pattern after arrow' };
            }
            const protocolDir = restoredParts[currentIndex];
            
            // Check for parallel syntax: (...)
            const parallelMatch = protocolDir.match(/^\((.+)\)$/);
            
            if (parallelMatch) {
                const innerContent = parallelMatch[1];
                const steps = innerContent.split('&').map(s => s.trim());
                
                // Check if this is parallel OUTPUTS (contains ->) or parallel INPUTS (no ->)
                const hasArrowInSteps = steps.some(s => s.includes('->') || s.includes('<-'));
                
                if (hasArrowInSteps) {
                    // PARALLEL OUTPUTS: (PROTO DIR -> TARGET & PROTO DIR -> TARGET -> ...)
                    // Each branch can continue after its target - parse each as a full chain
                    for (let i = 0; i < steps.length; i++) {
                        const step = steps[i];
                        
                        // Parse the first connection: "PROTO DIR -> TARGET"
                        const firstConnectionMatch = step.match(/^(.+?)\s+(PULL|PUSH)\s*(->|<-)\s*(.+)$/i);
                        if (!firstConnectionMatch) {
                            return { error: `Invalid parallel output: "${step}". Expected: PROTOCOL DIRECTION -> TARGET` };
                        }
                        const protocol = firstConnectionMatch[1].trim();
                        const direction = firstConnectionMatch[2].toUpperCase();
                        const arrow = firstConnectionMatch[3];
                        const restAfterFirstArrow = firstConnectionMatch[4].trim();
                        
                        // Check if there's continuation after the target
                        const restParts = restAfterFirstArrow.split(/(->|<-)/).map(p => p.trim()).filter(p => p);
                        const target = restParts[0];
                        const hasContinuation = restParts.length > 1;
                        
                        // Add the first connection (parallel output)
                        segments.push({
                            type: 'connection',
                            arrow: arrow,
                            protocol: protocol,
                            direction: direction,
                            toEntity: target,
                            stepNumber: i + 1,
                            isParallelOutput: true
                        });
                        
                        // Add target entity
                        segments.push({ 
                            type: 'entity', 
                            value: target, 
                            isParallelOutputTarget: !hasContinuation 
                        });
                        
                        // If there's continuation, parse it recursively using tokenizeChain
                        if (hasContinuation) {
                            // The continuation text starts from the target entity
                            // Format: "TARGET -> PROTO DIR -> ENTITY -> PROTO DIR -> ENTITY ..."
                            // Continuation in parallel outputs
                            const continuationText = restAfterFirstArrow;
                            
                            // Parse the continuation as a regular chain (starting from target)
                            // This will correctly handle multiple steps
                            const continuationResult = this.tokenizeChain(continuationText);
                            if (continuationResult.error) {
                                return continuationResult;
                            }
                            
                            // Add continuation segments, but skip the first entity (target) as it's already added
                            const continuationSegments = continuationResult.segments;
                            let skipFirstEntity = true;
                            for (const contSeg of continuationSegments) {
                                if (skipFirstEntity && contSeg.type === 'entity' && contSeg.value === target) {
                                    skipFirstEntity = false;
                                    continue; // Skip duplicate target entity
                                }
                                skipFirstEntity = false;
                                // Mark continuation segments so they can be identified during rendering
                                contSeg.isContinuation = true;
                                // Mark which parallel output branch this continuation belongs to
                                contSeg.parallelOutputStepNumber = i + 1;
                                segments.push(contSeg);
                            }
                        }
                    }
                    // Move past the parallel block - this ends the pattern
                    currentIndex++;
                    continue;
                } else {
                    // PARALLEL INPUTS: (FTP PUSH & JMS PUSH) -> TARGET
                    let protocolSteps = [];
                    for (let i = 0; i < steps.length; i++) {
                        const stepMatch = steps[i].match(/^(.+?)\s+(PULL|PUSH)$/i);
                        if (!stepMatch) {
                            return { error: `Invalid protocol in parallel steps: "${steps[i]}". Expected: PROTOCOL PULL/PUSH` };
                        }
                        protocolSteps.push({
                            protocol: stepMatch[1].trim(),
                            direction: stepMatch[2].toUpperCase(),
                            stepNumber: i + 1
                        });
                    }
                    currentIndex++;

                    // Expect second arrow
                    if (currentIndex >= restoredParts.length) {
                        return { error: 'Unexpected end of pattern, expected arrow after parallel inputs' };
                    }
                    const arrow2 = restoredParts[currentIndex];
                    if (arrow2 !== '<-' && arrow2 !== '->') {
                        return { error: `Expected arrow (<- or ->), got: "${arrow2}"` };
                    }
                    if (arrow1 !== arrow2) {
                        return { error: `Inconsistent arrows: ${arrow1} and ${arrow2}. Both should match.` };
                    }
                    currentIndex++;

                    // Expect entity
                    if (currentIndex >= restoredParts.length) {
                        return { error: 'Unexpected end of pattern, expected entity' };
                    }
                    const entity = restoredParts[currentIndex];

                    // Add connection segments for parallel inputs
                    protocolSteps.forEach(step => {
                        segments.push({
                            type: 'connection',
                            arrow: arrow1,
                            protocol: step.protocol,
                            direction: step.direction,
                            toEntity: entity,
                            stepNumber: step.stepNumber,
                            isParallelInput: true
                        });
                    });

                    segments.push({ type: 'entity', value: entity });
                    currentIndex++;
                }
            } else {
                // Single protocol direction
                const pdMatch = protocolDir.match(/^(.+?)\s+(PULL|PUSH)$/i);
                if (!pdMatch) {
                    return { error: `Invalid protocol/direction: "${protocolDir}". Expected: PROTOCOL PULL/PUSH` };
                }
                currentIndex++;

                // Expect second arrow
                if (currentIndex >= restoredParts.length) {
                    return { error: 'Unexpected end of pattern, expected arrow' };
                }
                const arrow2 = restoredParts[currentIndex];
                if (arrow2 !== '<-' && arrow2 !== '->') {
                    return { error: `Expected arrow (<- or ->), got: "${arrow2}"` };
                }
                if (arrow1 !== arrow2) {
                    return { error: `Inconsistent arrows: ${arrow1} and ${arrow2}. Both should match.` };
                }
                currentIndex++;

                // Expect entity
                if (currentIndex >= restoredParts.length) {
                    return { error: 'Unexpected end of pattern, expected entity' };
                }
                const entity = restoredParts[currentIndex];

                segments.push({
                    type: 'connection',
                    arrow: arrow1,
                    protocol: pdMatch[1].trim(),
                    direction: pdMatch[2].toUpperCase(),
                    toEntity: entity,
                    stepNumber: null
                });

                segments.push({ type: 'entity', value: entity });
                currentIndex++;
            }
        }

        return { segments };
    },


    buildGraph(segments) {
        const nodes = [];
        const edges = [];
        
        const nodeMap = new Map(); // label -> node
        
        let nodeIndex = 0;
        let edgeIndex = 0;

        // First pass: create nodes
        segments.forEach(seg => {
            if (seg.type === 'entity') {
                if (!nodeMap.has(seg.value)) {
                    const node = {
                        id: 'node_' + nodeIndex,
                        label: seg.value,
                        type: 'intermediate',
                        index: nodeIndex
                    };
                    nodes.push(node);
                    nodeMap.set(seg.value, node);
                    nodeIndex++;
                }
            }
        });

        // Set source type for first node
        const nodeLabels = [...nodeMap.keys()];
        if (nodeLabels.length > 0) {
            nodeMap.get(nodeLabels[0]).type = 'source';
        }

        // Second pass: build edges
        let lastEntityLabel = null;
        let parallelSourceLabel = null;
        // Track parallel output targets by step number
        const parallelOutputTargetsByStep = new Map(); // stepNumber -> label
        let currentParallelOutputStep = null;
        let inParallelGroup = false;
        
        segments.forEach((seg, segIndex) => {
            if (seg.type === 'entity') {
                const isParallelOutputTarget = seg.isParallelOutputTarget || false;
                const isContinuation = seg.isContinuation || false;
                
                // If we're in a parallel group and this entity follows a parallel output connection,
                // it's a parallel output target (even if not explicitly marked due to continuation)
                // IMPORTANT: Track it in the map so continuation segments can use it as source
                if (inParallelGroup && currentParallelOutputStep !== null) {
                    // This is a parallel output target - track it by step number
                    // This handles both explicit targets (isParallelOutputTarget=true) and 
                    // targets with continuation (isParallelOutputTarget=false but in parallel group)
                    // ALSO handle continuation entities - they need to be tracked so next continuation segments can use them
                    if (!isContinuation || (isContinuation && seg.parallelOutputStepNumber === currentParallelOutputStep)) {
                        parallelOutputTargetsByStep.set(currentParallelOutputStep, seg.value);
                    }
                    // Don't update lastEntity - parallel output targets don't become the next source
                    // Don't reset parallel tracking - we're still in the parallel output group
                } else if (isParallelOutputTarget) {
                    // Explicit parallel output target (no continuation) - fallback case
                    if (currentParallelOutputStep !== null) {
                        parallelOutputTargetsByStep.set(currentParallelOutputStep, seg.value);
                    }
                    // Don't update lastEntity - parallel output targets don't become the next source
                    // Don't reset parallel tracking - we're still in the parallel output group
                } else {
                    // For continuation entities, update the map entry so next continuation segments can use them
                    if (isContinuation && seg.parallelOutputStepNumber) {
                        parallelOutputTargetsByStep.set(seg.parallelOutputStepNumber, seg.value);
                    }
                    
                    lastEntityLabel = seg.value;
                    // Reset parallel tracking when we hit a non-parallel-output-target entity
                    // BUT: if this is a continuation entity, keep tracking active
                    if (!isContinuation) {
                        // Always reset parallel tracking for regular entities (including targets of parallel inputs)
                        // This ensures that the next parallel outputs use this entity as the source
                        inParallelGroup = false;
                        parallelSourceLabel = null;
                        currentParallelOutputStep = null;
                    }
                }
            } else if (seg.type === 'connection' && lastEntityLabel) {
                let fromLabel;
                
                // For parallel inputs or outputs, all connections share the same source
                if (seg.isParallelInput || seg.isParallelOutput) {
                    if (parallelSourceLabel === null) {
                        parallelSourceLabel = lastEntityLabel;
                    }
                    fromLabel = parallelSourceLabel;
                    inParallelGroup = true;
                    // Track which parallel output step we're processing (only for parallel outputs, not inputs)
                    if (seg.isParallelOutput) {
                        currentParallelOutputStep = seg.stepNumber;
                        // Pre-populate the map with the target entity so continuation segments can use it
                        // This ensures the map entry exists even if the entity segment hasn't been processed yet
                        const targetLabel = seg.toEntity;
                        if (targetLabel && !parallelOutputTargetsByStep.has(seg.stepNumber)) {
                            parallelOutputTargetsByStep.set(seg.stepNumber, targetLabel);
                        }
                    }
                } else if (seg.isContinuation && seg.parallelOutputStepNumber) {
                    // Continuation segments after parallel output targets should use the target as source
                    // The map entry gets updated after each continuation segment, so this will use the correct source
                    const targetLabel = parallelOutputTargetsByStep.get(seg.parallelOutputStepNumber);
                    if (targetLabel) {
                        fromLabel = targetLabel;
                    } else {
                        // Fallback: if map entry doesn't exist, try to infer from the segment order
                        // For the first continuation segment, use the parallel output target
                        // For subsequent segments, use lastEntityLabel (updated by previous continuation)
                        if (lastEntityLabel && lastEntityLabel !== parallelSourceLabel) {
                            // lastEntityLabel has been updated by a previous continuation segment
                            fromLabel = lastEntityLabel;
                        } else {
                            // First continuation segment - use the target from the parallel output edge
                            // This is a fallback - the map should have been populated
                            fromLabel = lastEntityLabel;
                        }
                    }
                    // Don't update lastEntityLabel here - we'll update it after processing the connection
                    // Keep parallel tracking active for continuation chains
                } else {
                    fromLabel = lastEntityLabel;
                    parallelSourceLabel = null;
                    currentParallelOutputStep = null;
                    inParallelGroup = false;
                }
                
                const toLabel = seg.toEntity;

                // Get the correct node IDs
                let fromNodeId = nodeMap.get(fromLabel)?.id;
                let toNodeId = nodeMap.get(toLabel)?.id;
                
                // Ensure node IDs are set - if not, this indicates a parsing/graph building issue
                if (!fromNodeId) {
                    console.warn('Edge missing fromNodeId:', { fromLabel, toLabel, protocol: seg.protocol });
                }
                if (!toNodeId) {
                    console.warn('Edge missing toNodeId:', { fromLabel, toLabel, protocol: seg.protocol });
                }

                // Determine flow direction based on arrow
                let flowDirection = seg.arrow === '<-' ? 'reverse' : 'forward';

                edges.push({
                    id: 'edge_' + edgeIndex,
                    fromLabel: fromLabel,
                    toLabel: toLabel,
                    fromNodeId: fromNodeId,
                    toNodeId: toNodeId,
                    protocol: seg.protocol,
                    direction: seg.direction,
                    flowDirection: flowDirection,
                    stepNumber: seg.stepNumber,
                    parallelOutputStepNumber: seg.parallelOutputStepNumber || null,
                    isParallelOutput: seg.isParallelOutput || false,
                    isParallelInput: seg.isParallelInput || false,
                    isContinuation: seg.isContinuation || false,
                    index: edgeIndex
                });
                edgeIndex++;
                
                // Update lastEntityLabel for non-parallel connections
                // Parallel inputs/outputs share the same source, so don't update
                // Continuation segments update the map but NOT lastEntityLabel (to avoid interference)
                if (!seg.isParallelInput && !seg.isParallelOutput) {
                    if (seg.isContinuation && seg.parallelOutputStepNumber) {
                        // For continuation segments, update the map entry so subsequent continuation segments use the correct source
                        // But DON'T update lastEntityLabel to avoid interfering with other logic
                        parallelOutputTargetsByStep.set(seg.parallelOutputStepNumber, toLabel);
                    } else {
                        // Regular (non-continuation) segments update lastEntityLabel normally
                        lastEntityLabel = toLabel;
                    }
                }
            }
        });

        // After edges are built, correctly identify target nodes (nodes with no outgoing edges)
        // Reset all node types to intermediate first (except source)
        nodes.forEach(node => {
            if (node.type === 'source') return; // Keep source nodes
            node.type = 'intermediate';
        });
        
        // Find nodes that are targets of edges but have no outgoing edges
        const nodesWithOutgoingEdges = new Set();
        edges.forEach(edge => {
            if (edge.fromNodeId) {
                const fromNode = nodes.find(n => n.id === edge.fromNodeId);
                if (fromNode) {
                    nodesWithOutgoingEdges.add(fromNode.id);
                }
            }
        });
        
        // Mark nodes without outgoing edges as targets
        nodes.forEach(node => {
            if (node.type === 'source') return;
            if (!nodesWithOutgoingEdges.has(node.id)) {
                node.type = 'target';
            }
        });


        return { nodes, edges, error: null };
    }
};
