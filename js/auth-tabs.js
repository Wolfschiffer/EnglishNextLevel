(function (root, factory) {
    const api = factory();

    if (typeof module === 'object' && module.exports) {
        module.exports = api;
    }

    if (root) {
        root.EnglishNextLevelAuthTabs = api;
    }
})(typeof window !== 'undefined' ? window : globalThis, () => {
    function create(dependencies = {}) {
        const document = dependencies.document || globalThis.document;
        let initialized = false;
        let panelsVisible = true;
        let onActivate = () => {};

        function getTabs() {
            return [...document.querySelectorAll('.auth-tab')];
        }

        function getPanel(tab) {
            const panelId = tab?.getAttribute('aria-controls');
            return panelId ? document.getElementById(panelId) : null;
        }

        function applyPanelVisibility(selectedTab) {
            for (const tab of getTabs()) {
                const panel = getPanel(tab);
                if (!panel) continue;

                const active = panelsVisible && tab === selectedTab;
                panel.classList.toggle('active', active);
                panel.setAttribute('aria-hidden', String(!active));
            }
        }

        function select(name, options = {}) {
            const tabs = getTabs();
            const selectedTab = tabs.find((tab) => tab.dataset.tab === name);
            if (!selectedTab) return false;

            for (const tab of tabs) {
                const selected = tab === selectedTab;
                tab.classList.toggle('active', selected);
                tab.setAttribute('aria-selected', String(selected));
                tab.tabIndex = selected ? 0 : -1;
            }

            applyPanelVisibility(selectedTab);
            if (options.focus) selectedTab.focus();
            return true;
        }

        function getSelected() {
            const tabs = getTabs();
            return tabs.find((tab) => tab.getAttribute('aria-selected') === 'true')?.dataset.tab
                || tabs.find((tab) => tab.classList.contains('active'))?.dataset.tab
                || tabs[0]?.dataset.tab
                || null;
        }

        function setPanelVisibility(visible) {
            panelsVisible = Boolean(visible);
            const selected = getSelected();
            const selectedTab = getTabs().find((tab) => tab.dataset.tab === selected);
            applyPanelVisibility(selectedTab);
        }

        function activate(name, options = {}) {
            if (!getTabs().some((tab) => tab.dataset.tab === name)) return false;
            onActivate(name);
            return select(name, options);
        }

        function handleKeydown(event) {
            const tabs = getTabs();
            const currentTab = event.currentTarget || event.target;
            const currentIndex = tabs.indexOf(currentTab);
            if (currentIndex < 0 || tabs.length < 1) return;

            let nextIndex;
            switch (event.key) {
                case 'ArrowRight':
                    nextIndex = (currentIndex + 1) % tabs.length;
                    break;
                case 'ArrowLeft':
                    nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                    break;
                case 'Home':
                    nextIndex = 0;
                    break;
                case 'End':
                    nextIndex = tabs.length - 1;
                    break;
                default:
                    return;
            }

            event.preventDefault();
            activate(tabs[nextIndex].dataset.tab, { focus: true });
        }

        function initialize(onTabActivate = () => {}) {
            if (initialized) return;
            initialized = true;
            onActivate = typeof onTabActivate === 'function' ? onTabActivate : () => {};

            const tabs = getTabs();
            const initialName = getSelected();
            select(initialName);

            for (const tab of tabs) {
                tab.addEventListener('click', () => activate(tab.dataset.tab));
                tab.addEventListener('keydown', handleKeydown);
            }
        }

        return Object.freeze({ activate, getSelected, initialize, select, setPanelVisibility });
    }

    return Object.freeze({ create });
});
