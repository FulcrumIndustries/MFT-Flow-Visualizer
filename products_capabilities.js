// Product capabilities organized by client and server roles
const PRODUCT_CAPABILITIES = {
    "SecureTransport": {
        name: "SecureTransport",
        client: [
            "PeSIT PUSH",
            "PeSIT PULL",
            "SFTP PUSH",
            "SFTP PULL",
            "HTTP PUSH",
            "HTTP PULL",
            "HTTPS PUSH",
            "HTTPS PULL",
            "FTP PUSH",
            "FTP PULL",
            "FTPS PUSH",
            "FTPS PULL",
            "Amazon S3 PUSH",
            "Amazon S3 PULL",
            "Google Cloud Storage PUSH",
            "Google Cloud Storage PULL",
            "Azure Blob Storage PUSH",
            "Azure Blob Storage PULL",
            "Azure File Storage PUSH",
            "Azure File Storage PULL",
            "SharePoint PUSH",
            "SharePoint PULL",
            "Google Drive PUSH",
            "Google Drive PULL",
            "OneDrive PUSH",
            "OneDrive PULL",
            "SMB Connector PUSH",
            "SMB Connector PULL",
            "Hadoop Connector PUSH",
            "Hadoop Connector PULL",
            "SYNCPLICITY PUSH",
            "SYNCPLICITY PULL",
            "JMS PUSH",
            "JMS PULL",
            "AS2 PUSH",
            "AS2 PULL",
            "SSH PUSH",
            "SSH PULL",
        ],
        server: [
            "PeSIT SERVER",
            "PeSIT SSL SERVER",
            "SCP SERVER",
            "SFTP SERVER",
            "HTTP SERVER",
            "HTTPS SERVER",
            "HSTS SERVER",
            "FTP SERVER",
            "FTPS SERVER",
            "AS2 SERVER",
            "SSH SERVER",
        ]
    },
    "Transfer CFT": {
        name: "Transfer CFT",
        client: [
            "PeSIT PUSH",
            "PeSIT PULL",
            "SFTP PUSH",
            "SFTP PULL",
        ],
        server: [
            "SFTP SERVER",
            "PeSIT SERVER",
            "PeSIT SSL SERVER"
        ]
    },
    "Secure Financial Client": {
        name: "Secure Financial Client",
        client: [
            "EBICS PUSH",
            "EBICS PULL",
            "SWIFTNET FILEACT PUSH",
            "SWIFTNET FILEACT PULL",
            "SWIFTNET INTERACT SEND",
            "SWIFTNET INTERACT RECEIVE",
        ],
        server: []
    },
    "Electronic Signature": {
        name: "Electronic Signature",
        client: [
            "EBICS TS PUSH",
            "EBICS TS PULL",
            ],
        server: []
    },
    "API Gateway": {
        name: "API Gateway",
        client: [
            "JMS PUSH",
            "JMS PULL",
            "HTTP PUSH",
            "HTTP PULL",
            "HTTPS PUSH",
            "HTTPS PULL",
            "IBM MQ PUSH",
            "IBM MQ PULL",
            "AMQP PUSH",
            "AMQP PULL",
            "AMQPS PUSH",
            "AMQPS PULL",
            "SOAP PUSH",
            "SOAP PULL",
            "FILEBASE PUSH",
            "FILEBASE PULL",
        ],
        server: [
            "JMS SERVER",
            "HTTP SERVER",
            "HTTPS SERVER",
            "SOAP SERVER",
            "AMQP SERVER",
        ]
    },
    "Amplify Fusion": {
        name: "Amplify Fusion",
        client: [
            "JMS PUSH",
            "JMS PULL",
            "HTTP PUSH",
            "HTTP PULL",
            "HTTPS PUSH",
            "HTTPS PULL",
            "AMQP PUSH",
            "AMQP PULL",
            "AMQPS PUSH",
            "AMQPS PULL",
            "JDBC PUSH",
            "JDBC PULL",
            "KAFKA PUSH",
            "KAFKA PULL",
        ],
        server: [
            "JMS SERVER",
            "HTTP SERVER",
            "HTTPS SERVER",
            "MCP SERVER",
        ]
    }
};

// Helper function to normalize protocol names for matching
// Converts protocol names (any case) to the format used in capabilities
function normalizeProtocolName(protocol) {
    const protocolMap = {
        'PESIT': 'PeSIT',
        'EBICS': 'EBICS',
        'SWIFT': 'SWIFT',
        'SFTP': 'SFTP',
        'HTTP': 'HTTP',
        'HTTPS': 'HTTPS',
        'FTP': 'FTP',
        'FTPS': 'FTPS',
        'AS2': 'AS2',
        'SSH': 'SSH',
        'JMS': 'JMS',
        'SCP': 'SCP',
        'HSTS': 'HSTS',
        'AMAZON S3': 'Amazon S3',
        'GOOGLE CLOUD STORAGE': 'Google Cloud Storage',
        'AZURE BLOB STORAGE': 'Azure Blob Storage',
        'AZURE FILE STORAGE': 'Azure File Storage',
        'SHAREPOINT': 'SharePoint',
        'GOOGLE DRIVE': 'Google Drive',
        'ONEDRIVE': 'OneDrive',
        'SMB CONNECTOR': 'SMB Connector',
        'HADOOP CONNECTOR': 'Hadoop Connector'
    };
    
    // Normalize input to uppercase for matching
    const upperProtocol = protocol.toUpperCase().trim();
    
    // Try exact match
    if (protocolMap[upperProtocol]) {
        return protocolMap[upperProtocol];
    }
    
    // If no match found, return original protocol (might be a new protocol)
    // Try to preserve original case if it looks reasonable
    return protocol;
}

// Helper function to get all capabilities (client + server) for a product
function getAllCapabilities(productName) {
    const product = PRODUCT_CAPABILITIES[productName];
    if (!product) return [];
    return [...product.client, ...product.server];
}

// Helper function to find products that support a given protocol capability
function findProductsForCapability(capability) {
    const matchingProducts = [];
    
    // Parse the capability string (format: "PROTOCOL DIRECTION")
    const parts = capability.split(' ');
    if (parts.length >= 2) {
        const protocol = parts.slice(0, -1).join(' ').trim();
        const direction = parts[parts.length - 1].trim().toUpperCase();
        
        // Normalize protocol name for matching
        const normalizedProtocol = normalizeProtocolName(protocol);
        const normalizedCapability = `${normalizedProtocol} ${direction}`;
        
        for (const [productName, product] of Object.entries(PRODUCT_CAPABILITIES)) {
            const allCaps = getAllCapabilities(productName);
            // Try exact match first
            if (allCaps.includes(normalizedCapability)) {
                matchingProducts.push(productName);
            } else {
                // Try case-insensitive match
                const normalizedCapUpper = normalizedCapability.toUpperCase();
                if (allCaps.some(cap => cap.toUpperCase() === normalizedCapUpper)) {
                    matchingProducts.push(productName);
                }
            }
        }
    }
    
    return matchingProducts;
}

// Helper function to get all unique capabilities from all products
function getAllAvailableCapabilities() {
    const allCapabilities = new Set();
    for (const [productName, product] of Object.entries(PRODUCT_CAPABILITIES)) {
        const caps = getAllCapabilities(productName);
        caps.forEach(cap => allCapabilities.add(cap));
    }
    return Array.from(allCapabilities).sort();
}

// Helper function to check if a protocol+direction combination exists in capabilities
function isValidCapability(protocol, direction) {
    if (!protocol || !direction) return false;
    
    // Trim whitespace
    protocol = String(protocol).trim();
    direction = String(direction).trim();
    
    if (!protocol || !direction) return false;
    
    const dirUpper = direction.toUpperCase();
    const normalizedProtocol = normalizeProtocolName(protocol);
    
    // Build capability strings to check
    const capabilitiesToCheck = [
        `${normalizedProtocol} ${dirUpper}`,  // Normalized version
        `${protocol} ${dirUpper}`,            // Original version
        `${protocol} ${direction}`            // Original with original case
    ];
    
    // Check all products for this capability
    for (const [productName, product] of Object.entries(PRODUCT_CAPABILITIES)) {
        const allCaps = getAllCapabilities(productName);
        
        // Try exact matches first
        for (const capToCheck of capabilitiesToCheck) {
            if (allCaps.includes(capToCheck)) {
                return true;
            }
        }
        
        // Try case-insensitive match for all variations
        for (const capToCheck of capabilitiesToCheck) {
            const capUpper = capToCheck.toUpperCase();
            if (allCaps.some(cap => cap.toUpperCase() === capUpper)) {
                return true;
            }
        }
    }
    return false;
}

// Helper function to determine required products based on protocol capabilities used in patterns
// Logic: 
// - For flows with intermediate nodes: intermediate nodes require products
// - For direct flows (source -> target): suggest products that support the protocol used
// Arrow direction matters:
// - Forward arrows (->): FROM node performs action, TO node receives
// - Reverse arrows (<-): TO node performs action, FROM node receives
// The performing node needs CLIENT capability, the receiving node needs SERVER capability
function getRequiredProducts(flows) {
    const requiredCapabilities = new Set();
    
    // Extract required capabilities from flows
    flows.forEach(flow => {
        if (!flow || !flow.edges || !flow.nodes) return;
        
        // Create a map of node labels to node types for quick lookup
        const nodeMap = new Map();
        flow.nodes.forEach(node => {
            nodeMap.set(node.label, node.type);
        });
        
        // Check if this is a direct flow (source -> target without intermediates)
        const hasIntermediates = flow.nodes.some(node => node.type === 'intermediate');
        
        flow.edges.forEach(edge => {
            const fromType = nodeMap.get(edge.fromLabel);
            const toType = nodeMap.get(edge.toLabel);
            
            // Determine which node is the client (performing action) and which is the server (receiving)
            // based on arrow direction (flowDirection)
            let clientNode, serverNode, clientType, serverType;
            
            if (edge.flowDirection === 'reverse') {
                // For <- arrows: TO node is client (performing action), FROM node is server
                clientNode = edge.toLabel;
                serverNode = edge.fromLabel;
                clientType = toType;
                serverType = fromType;
            } else {
                // For -> arrows: FROM node is client (performing action), TO node is server
                clientNode = edge.fromLabel;
                serverNode = edge.toLabel;
                clientType = fromType;
                serverType = toType;
            }
            
            // If the CLIENT node is intermediate: require CLIENT capability (PUSH or PULL)
            if (clientType === 'intermediate') {
                const clientCapability = `${edge.protocol} ${edge.direction}`;
                requiredCapabilities.add(clientCapability);
            }
            
            // If the SERVER node is intermediate: require SERVER capability
            if (serverType === 'intermediate') {
                const serverCapability = `${edge.protocol} SERVER`;
                requiredCapabilities.add(serverCapability);
            }
            
            // For direct flows (no intermediates), suggest products based on the protocol used
            // This helps users know which products could handle this type of transfer
            if (!hasIntermediates) {
                // Add both CLIENT capability (for the sending side)
                const clientCapability = `${edge.protocol} ${edge.direction}`;
                requiredCapabilities.add(clientCapability);
                // Add SERVER capability (for the receiving side)
                const serverCapability = `${edge.protocol} SERVER`;
                requiredCapabilities.add(serverCapability);
            }
        });
    });
    
    // Find products that support these capabilities
    const productSupport = {};
    requiredCapabilities.forEach(capability => {
        const products = findProductsForCapability(capability);
        products.forEach(product => {
            if (!productSupport[product]) {
                productSupport[product] = new Set();
            }
            productSupport[product].add(capability);
        });
    });
    
    // Return products sorted by name
    return Object.keys(productSupport).sort().map(productName => ({
        name: productName,
        supportedCapabilities: Array.from(productSupport[productName]).sort()
    }));
}