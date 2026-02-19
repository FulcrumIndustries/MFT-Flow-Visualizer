// APPLICATION INITIALIZATION
// ============================================
function initApp() {
    // Initialize workspace manager (loads from storage or creates default)
    WorkspaceManager.initialize();

    // Apply saved theme
    document.body.setAttribute('data-theme', StateManager.state.theme);

    // Initialize UI
    UIController.init();
    UIController.updateWorkspaceSelect();
    UIController.loadActiveWorkspace();
    UIController.updateThemeIcon();
}

// Start the application when DOM is ready
document.addEventListener('DOMContentLoaded', initApp);
