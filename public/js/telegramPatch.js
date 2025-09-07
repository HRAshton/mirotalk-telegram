(() => {
    const getUserName = () => {
        return window.Telegram?.WebApp?.initDataUnsafe?.user?.username
            || `user${Math.floor(Math.random() * 1000)}`;
    };

    /**
     * Full auto-join flow. If URL contains ?autojoin=1 (or auto=1 / autoJoin=1)
     * it will pick a name, sanitize it, check availability (if checkUserName exists),
     * and call the existing client join helpers (checkPeerAudioVideo, whoAreYouJoin, playSound).
     * Returns true when it handled the join (so caller can return early), false otherwise.
     * Note: this function intentionally depends on global helpers from client.js at call-time.
     * @returns {Promise<boolean>}
     */
    const autojoin = async () => {
        try {
            const qs = new URLSearchParams(window.location.search);
            const val = qs.get('autojoin') || qs.get('autoJoin') || qs.get('auto');
            const isAuto = val === '1' || val === 'true';
            if (!isAuto) return false;

            // Determine candidate name: prefer persisted, then Telegram name, then generated guest
            let name = null;
            try {
                name = window.localStorage?.peer_name || getUserName();
            } catch (e) {
                name = getUserName();
            }

            if (!name || typeof name !== 'string' || name.trim() === '') {
                name = 'Guest-' + Math.floor(1000 + Math.random() * 9000);
            }

            // If client provides filterXSS, use it to sanitize; otherwise basic strip
            if (typeof window.filterXSS === 'function') {
                name = window.filterXSS(name);
            } else {
                name = name.replace(/[\r\n<>]/g, '').trim();
            }

            // If client provides isHtml, validate name and fallback
            if (typeof window.isHtml === 'function' && window.isHtml(name)) {
                if (typeof window.makeId === 'function') {
                    name = 'Guest-' + window.makeId(4);
                } else {
                    name = 'Guest-' + Math.floor(1000 + Math.random() * 9000);
                }
            }

            // Persist
            try {
                window.localStorage.peer_name = name;
            } catch (e) {
                /* ignore */
            }

            // If client exposes checkUserName, use it to ensure availability
            if (typeof window.checkUserName === 'function') {
                try {
                    const exists = await window.checkUserName(name);
                    if (exists) {
                        // If token not provided, call client's userNameAlreadyInRoom if available
                        if (!window.myToken) {
                            if (typeof window.userNameAlreadyInRoom === 'function') {
                                window.userNameAlreadyInRoom();
                                return true;
                            }
                            return false;
                        }
                        // if token exists, allow join to proceed
                    }
                } catch (err) {
                    console.error('autojoin checkUserName error', err);
                    // proceed anyway
                }
            }

            // Set global myPeerName if available
            try {
                window.myPeerName = name;
            } catch (e) {
                // ignore
            }

            // Call existing client helpers if present
            if (typeof window.checkPeerAudioVideo === 'function') {
                try {
                    window.checkPeerAudioVideo();
                } catch (e) {
                    console.warn('checkPeerAudioVideo failed', e);
                }
            }
            if (typeof window.whoAreYouJoin === 'function') {
                try {
                    window.whoAreYouJoin();
                } catch (e) {
                    console.warn('whoAreYouJoin failed', e);
                }
            }
            if (typeof window.playSound === 'function') {
                try {
                    window.playSound('addPeer');
                } catch (e) {
                    /* ignore */
                }
            }

            return true;
        } catch (err) {
            console.error('telegramPatch.autojoin error', err);
            return false;
        }
    };

    window.telegramPatch = {
        getUserName,
        autojoin,
    };
})();