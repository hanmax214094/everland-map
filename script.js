document.addEventListener('DOMContentLoaded', () => {
    L.Icon.Default.imagePath = 'vendor/leaflet/images/';

    const isMobile = () => window.innerWidth <= 768;
    const isIOSDevice = () => /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

    const map = L.map('map', {
        attributionControl: false
    }).setView([37.295, 127.204], 15);
    let marker = null;
    let userLocationMarker = null;

    const locateOptions = {
        setView: true,
        maxZoom: 16,
        enableHighAccuracy: true,
        timeout: 15000
    };
    let hasFallbackAttempted = false;

    const showUserLocation = (latlng, accuracy = 0) => {
        const normalizedAccuracy = Number.isFinite(accuracy) && accuracy > 0 ? accuracy : 0;
        const radius = normalizedAccuracy / 2;
        const circleRadius = radius || 25;
        const popupMessage = radius
            ? `您在這裡 (誤差約 ${radius.toFixed(0)} 公尺)`
            : '您在這裡';

        if (userLocationMarker) map.removeLayer(userLocationMarker);
        userLocationMarker = L.circle(latlng, circleRadius, {
            color: '#2c7be5',
            fillColor: '#60a5fa',
            fillOpacity: 0.25
        }).addTo(map);
        userLocationMarker.bindPopup(popupMessage).openPopup();
    };

    const handleGeolocationSuccess = (position) => {
        const latlng = L.latLng(position.coords.latitude, position.coords.longitude);
        const accuracy = position.coords.accuracy ?? 0;
        showUserLocation(latlng, accuracy);
        if (locateOptions.setView) {
            const targetZoom = locateOptions.maxZoom ?? map.getZoom();
            map.setView(latlng, targetZoom);
        }
    };

    const triggerLocate = () => {
        hasFallbackAttempted = false;
        if (navigator.geolocation && isIOSDevice()) {
            navigator.geolocation.getCurrentPosition(
                handleGeolocationSuccess,
                (error) => {
                    alert(`定位錯誤：${getLocationErrorMessage(error.code)}`);
                },
                {
                    enableHighAccuracy: true,
                    timeout: 20000,
                    maximumAge: 0
                }
            );
            return;
        }
        map.locate(locateOptions);
    };

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const attributionControl = L.control.attribution({
        position: isMobile() ? 'topright' : 'bottomright'
    }).addTo(map);

    const updateAttributionPosition = () => {
        attributionControl.setPosition(isMobile() ? 'topright' : 'bottomright');
    };

    const LocateControl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: function (mapInstance) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom leaflet-control-locate');
            container.innerHTML = '<a href="#" title="我的位置"></a>';
            container.onclick = (e) => {
                e.preventDefault();
                triggerLocate();
            };
            return container;
        }
    });
    map.addControl(new LocateControl());

    map.on('locationfound', (e) => {
        showUserLocation(e.latlng, e.accuracy);
    });

    const getLocationErrorMessage = (code, isFallback = false) => {
        const PERMISSION_DENIED = 1;
        const POSITION_UNAVAILABLE = 2;
        const TIMEOUT = 3;
        let message = '無法取得您的位置。';

        switch (code) {
            case PERMISSION_DENIED: {
                if (isIOSDevice()) {
                    message = '請在「設定 > Safari > 位置」允許此網站使用定位功能，或在頁面重新載入後允許定位權限。';
                } else {
                    message = '請允許此網站使用定位功能。';
                }
                break;
            }
            case POSITION_UNAVAILABLE:
                message = isFallback
                    ? '目前無法透過裝置的定位服務取得位置，請確認裝置有良好訊號並已開啟定位功能。'
                    : '目前的定位服務不可用，請確認已開啟定位或稍後再試。';
                break;
            case TIMEOUT:
                message = '定位逾時，請確認定位服務狀態後再試一次。';
                break;
            default:
                break;
        }

        return message;
    };

    const attemptFallbackGeolocation = (originalError) => {
        if (hasFallbackAttempted || !navigator.geolocation) {
            alert(`定位錯誤：${getLocationErrorMessage(originalError.code)}`);
            return;
        }

        hasFallbackAttempted = true;
        navigator.geolocation.getCurrentPosition(
            (position) => {
                handleGeolocationSuccess(position);
            },
            (fallbackError) => {
                alert(`定位錯誤：${getLocationErrorMessage(fallbackError.code, true)}`);
            },
            {
                enableHighAccuracy: true,
                timeout: 20000,
                maximumAge: 0
            }
        );
    };

    map.on('locationerror', (e) => {
        attemptFallbackGeolocation(e);
    });

    const facilityList = document.querySelector('.facility-list');
    const listControls = document.getElementById('list-controls');
    const listContent = document.getElementById('list-content');
    const searchBox = document.getElementById('search-box');
    const filterButtonsContainer = document.getElementById('filter-buttons');
    const dragHandle = listControls.querySelector('.drag-handle');
    const headerLocateButton = document.querySelector('[data-action="locate"]');

    const mobileListToggle = document.createElement('button');
    mobileListToggle.type = 'button';
    mobileListToggle.id = 'mobile-list-toggle';
    mobileListToggle.innerHTML = '&#9776;';
    mobileListToggle.setAttribute('aria-label', '展開設施列表');
    mobileListToggle.setAttribute('aria-controls', 'facility-list');
    mobileListToggle.setAttribute('aria-expanded', 'false');
    mobileListToggle.hidden = !isMobile();

    const mobileBackdrop = document.createElement('div');
    mobileBackdrop.className = 'mobile-backdrop';

    document.body.appendChild(mobileBackdrop);
    document.body.appendChild(mobileListToggle);

    const menuModal = document.createElement('div');
    menuModal.id = 'menu-modal';
    menuModal.className = 'menu-modal';
    menuModal.setAttribute('aria-hidden', 'true');
    menuModal.innerHTML = `
        <div class="menu-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="menu-modal-title">
            <button type="button" class="menu-modal__close" aria-label="關閉菜單視窗">&times;</button>
            <div class="menu-modal__header">
                <p class="menu-modal__subtitle">餐點菜單</p>
                <h2 id="menu-modal-title" class="menu-modal__title"></h2>
            </div>
            <div class="menu-modal__body">
                <div class="menu-modal__list" role="list"></div>
            </div>
        </div>
    `;
    document.body.appendChild(menuModal);

    const menuModalClose = menuModal.querySelector('.menu-modal__close');
    const menuModalTitle = menuModal.querySelector('.menu-modal__title');
    const menuModalBody = menuModal.querySelector('.menu-modal__body');
    const menuModalList = menuModal.querySelector('.menu-modal__list');

    let previousFocusedElement = null;

    const formatMenuName = (menuItem) => {
        const candidates = [menuItem?.menuDescrtCN, menuItem?.menuDescrtEng, menuItem?.menuDescrt];
        return candidates.find(text => typeof text === 'string' && text.trim().length > 0)?.trim() || '餐點';
    };

    const formatMenuPrice = (price) => {
        if (typeof price !== 'number' || Number.isNaN(price)) return '';
        return price.toLocaleString('zh-TW');
    };

    const createMenuCard = (menuItem) => {
        const card = document.createElement('article');
        card.className = 'menu-card';
        card.setAttribute('role', 'listitem');

        if (menuItem?.menuImagUrl) {
            const img = document.createElement('img');
            img.className = 'menu-card__image';
            img.src = menuItem.menuImagUrl;
            img.alt = `${formatMenuName(menuItem)} 圖片`;
            img.loading = 'lazy';
            card.appendChild(img);
        }

        const content = document.createElement('div');
        content.className = 'menu-card__content';

        const title = document.createElement('h4');
        title.className = 'menu-card__title';
        title.textContent = formatMenuName(menuItem);
        content.appendChild(title);

        const englishName = typeof menuItem?.menuDescrtEng === 'string' ? menuItem.menuDescrtEng.trim() : '';
        if (englishName && englishName !== title.textContent) {
            const subtitle = document.createElement('p');
            subtitle.className = 'menu-card__subtitle';
            subtitle.textContent = englishName;
            content.appendChild(subtitle);
        }

        const priceValue = formatMenuPrice(menuItem?.menuPrice);
        if (priceValue) {
            const price = document.createElement('p');
            price.className = 'menu-card__price';
            price.textContent = `價格：${priceValue}`;
            content.appendChild(price);
        }

        card.appendChild(content);
        return card;
    };

    const showMenuModal = (facility, triggerElement = null) => {
        if (!facility?.menuList || facility.menuList.length === 0) return;
        previousFocusedElement = triggerElement instanceof HTMLElement ? triggerElement : document.activeElement;
        menuModalTitle.textContent = facility.name;
        menuModalList.innerHTML = '';
        facility.menuList.forEach(menuItem => {
            menuModalList.appendChild(createMenuCard(menuItem));
        });
        if (menuModalBody) {
            menuModalBody.scrollTop = 0;
        }
        menuModal.classList.add('visible');
        menuModal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('menu-modal-open');
        menuModalClose.focus({ preventScroll: true });
    };

    const hideMenuModal = () => {
        if (!menuModal.classList.contains('visible')) return;
        menuModal.classList.remove('visible');
        menuModal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('menu-modal-open');
        if (previousFocusedElement && typeof previousFocusedElement.focus === 'function') {
            previousFocusedElement.focus({ preventScroll: true });
        }
    };

    menuModalClose.addEventListener('click', (event) => {
        event.stopPropagation();
        hideMenuModal();
    });

    menuModal.addEventListener('click', (event) => {
        if (event.target === menuModal) {
            hideMenuModal();
        }
    });

    const refreshMapSize = () => {
        requestAnimationFrame(() => map.invalidateSize());
    };

    const applyMobileState = (isOpen) => {
        facilityList.classList.toggle('open', isOpen);
        facilityList.setAttribute('aria-hidden', (!isOpen).toString());
        document.body.classList.toggle('list-open', isOpen);
        mobileBackdrop.classList.toggle('visible', isOpen);
        mobileListToggle.innerHTML = isOpen ? '&times;' : '&#9776;';
        mobileListToggle.setAttribute('aria-label', isOpen ? '關閉設施列表' : '展開設施列表');
        mobileListToggle.setAttribute('aria-expanded', isOpen.toString());
        refreshMapSize();
    };

    const resetDesktopState = () => {
        facilityList.classList.remove('open');
        facilityList.setAttribute('aria-hidden', 'false');
        document.body.classList.remove('list-open');
        mobileBackdrop.classList.remove('visible');
        mobileListToggle.innerHTML = '&#9776;';
        mobileListToggle.setAttribute('aria-expanded', 'false');
        mobileListToggle.setAttribute('aria-label', '展開設施列表');
        refreshMapSize();
    };

    const toggleFacilityList = (forceState) => {
        if (!isMobile()) return;
        const shouldOpen = typeof forceState === 'boolean'
            ? forceState
            : !facilityList.classList.contains('open');
        applyMobileState(shouldOpen);
    };

    if (dragHandle) {
        dragHandle.setAttribute('role', 'button');
        dragHandle.setAttribute('tabindex', '0');
        dragHandle.setAttribute('aria-label', '開啟或關閉設施列表');

        dragHandle.addEventListener('click', (event) => {
            event.stopPropagation();
            toggleFacilityList();
        });

        dragHandle.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                toggleFacilityList();
            }
        });
    }

    mobileListToggle.addEventListener('click', () => toggleFacilityList());
    mobileBackdrop.addEventListener('click', () => toggleFacilityList(false));

    searchBox.addEventListener('focus', () => {
        if (isMobile()) toggleFacilityList(true);
    });

    filterButtonsContainer.addEventListener('focusin', () => {
        if (isMobile()) toggleFacilityList(true);
    });

    listContent.addEventListener('focusin', () => {
        if (isMobile()) toggleFacilityList(true);
    });

    headerLocateButton?.addEventListener('click', (event) => {
        event.preventDefault();
        triggerLocate();
        if (isMobile()) toggleFacilityList(false);
    });

    const zoneMap = {
        '01': '環球集市 (Global Fair)',
        '02': '美洲冒險 (American Adventure)',
        '03': '魔術天地 (Magic Land)',
        '05': '歐洲冒險 (European Adventure)',
        '06': '動物王國 (Zootopia)',
        '12': '週邊設施 (Perimeter Facilities)',
        '99': '服務設施 (Services)'
    };
    const zoneClassMap = {
        '環球集市 (Global Fair)': 'zone-gf',
        '美洲冒險 (American Adventure)': 'zone-aa',
        '魔術天地 (Magic Land)': 'zone-ml',
        '歐洲冒險 (European Adventure)': 'zone-ea',
        '動物王國 (Zootopia)': 'zone-zt'
    };
    const categorySortOrder = [
        '環球集市 (Global Fair)',
        '美洲冒險 (American Adventure)',
        '魔術天地 (Magic Land)',
        '歐洲冒險 (European Adventure)',
        '動物王國 (Zootopia)',
        '週邊設施 (Perimeter Facilities)',
        '服務設施 (Services)'
    ];

    fetch('./all_facilt.json')
        .then(response => response.json())
        .then(data => {
            const categorizedFacilities = processData(data);
            renderList(categorizedFacilities);
            renderFilterButtons(categorizedFacilities);
        })
        .catch(error => {
            console.error('Error fetching data:', error);
            listContent.innerHTML = '<p>無法載入設施資料。</p>';
        });

    function processData(facilities) {
        const groupedByCategory = {};
        facilities.forEach(facilt => {
            if (!facilt.locList || facilt.locList.length === 0) return;
            const category = zoneMap[facilt.zoneKindCd] || '其他 (Others)';
            if (!groupedByCategory[category]) groupedByCategory[category] = {};
            const name = `${facilt.faciltNameCN}/${facilt.faciltNameEng} (${facilt.faciltName})`;
            const sanitizedMenu = Array.isArray(facilt.menuList)
                ? facilt.menuList.filter(item => item && (item.menuDescrtCN || item.menuDescrtEng || item.menuDescrt))
                : [];
            const hasMenuData = sanitizedMenu.length > 0;

            if (!groupedByCategory[category][name]) {
                groupedByCategory[category][name] = {
                    name,
                    locations: [],
                    isRestaurant: facilt.faciltCateKindCd === '04',
                    menuList: hasMenuData ? sanitizedMenu : []
                };
            } else {
                if (facilt.faciltCateKindCd === '04') {
                    groupedByCategory[category][name].isRestaurant = true;
                }
                if (hasMenuData) {
                    groupedByCategory[category][name].menuList = sanitizedMenu;
                }
            }
            facilt.locList.forEach(loc => {
                groupedByCategory[category][name].locations.push({
                    coords: [parseFloat(loc.latud), parseFloat(loc.lgtud)]
                });
            });
        });
        const finalGrouped = {};
        for (const category in groupedByCategory) {
            finalGrouped[category] = Object.values(groupedByCategory[category]).sort((a, b) =>
                a.name.localeCompare(b.name, 'zh-Hant')
            );
        }
        return finalGrouped;
    }

    function renderList(categorizedFacilities) {
        listContent.innerHTML = '';
        const sortedCategories = Object.keys(categorizedFacilities).sort((a, b) => {
            const orderA = categorySortOrder.indexOf(a);
            const orderB = categorySortOrder.indexOf(b);
            return (orderA === -1 ? 99 : orderA) - (orderB === -1 ? 99 : orderB);
        });
        sortedCategories.forEach(category => {
            const zoneClass = zoneClassMap[category] || '';
            const categoryHeader = document.createElement('h3');
            categoryHeader.textContent = category;
            if (zoneClass) categoryHeader.classList.add(zoneClass);
            categoryHeader.classList.add('category-header');
            categoryHeader.setAttribute('data-category', category);
            categoryHeader.setAttribute('role', 'button');
            categoryHeader.setAttribute('tabindex', '0');
            categoryHeader.setAttribute('aria-expanded', 'true');

            const ul = document.createElement('ul');
            ul.setAttribute('data-category', category);
            ul.setAttribute('role', 'list');
            ul.setAttribute('aria-hidden', 'false');

            const createFacilityListItem = (facilt) => {
                const li = document.createElement('li');
                li.setAttribute('role', 'listitem');
                li.setAttribute('tabindex', '0');
                li.dataset.name = facilt.name;
                li.dataset.fullName = facilt.name;
                if (zoneClass) li.classList.add(zoneClass);

                const itemRow = document.createElement('div');
                itemRow.className = 'facility-item-row';

                const hasMenu = facilt.isRestaurant && Array.isArray(facilt.menuList) && facilt.menuList.length > 0;
                if (hasMenu) {
                    li.classList.add('has-menu');
                    const menuButton = document.createElement('button');
                    menuButton.type = 'button';
                    menuButton.className = 'menu-trigger';
                    menuButton.setAttribute('aria-label', `查看${facilt.name}菜單`);
                    menuButton.title = '查看菜單';
                    menuButton.innerHTML = '<span class="sr-only">查看菜單</span>';
                    menuButton.addEventListener('click', (event) => {
                        event.stopPropagation();
                        showMenuModal(facilt, event.currentTarget);
                    });
                    itemRow.appendChild(menuButton);
                }

                const nameSpan = document.createElement('span');
                nameSpan.className = 'facility-item-name';
                nameSpan.textContent = facilt.name;
                itemRow.appendChild(nameSpan);

                li.appendChild(itemRow);
                if (facilt.locations.length > 1) {
                    li.classList.add('has-sublist');
                    li.setAttribute('aria-expanded', 'false');
                    const subUl = document.createElement('ul');
                    subUl.classList.add('sub-list', 'collapsed');
                    subUl.setAttribute('role', 'list');
                    subUl.setAttribute('aria-hidden', 'true');
                    facilt.locations.forEach((loc, index) => {
                        const subLi = document.createElement('li');
                        subLi.textContent = `地點 ${index + 1}`;
                        subLi.setAttribute('data-lat', loc.coords[0]);
                        subLi.setAttribute('data-lng', loc.coords[1]);
                        subLi.setAttribute('data-parent-name', facilt.name);
                        subLi.setAttribute('role', 'listitem');
                        subLi.setAttribute('tabindex', '0');
                        subLi.dataset.fullName = `${facilt.name} 地點 ${index + 1}`;
                        if (zoneClass) subLi.classList.add(zoneClass);
                        subUl.appendChild(subLi);
                    });
                    li.appendChild(subUl);
                } else {
                    li.setAttribute('data-lat', facilt.locations[0].coords[0]);
                    li.setAttribute('data-lng', facilt.locations[0].coords[1]);
                }
                return li;
            };

            const facilities = categorizedFacilities[category];
            const restaurantFacilities = facilities.filter(facilt => facilt.isRestaurant);
            const otherFacilities = facilities.filter(facilt => !facilt.isRestaurant);

            if (restaurantFacilities.length > 0) {
                const restaurantLi = document.createElement('li');
                restaurantLi.textContent = '餐廳';
                restaurantLi.classList.add('has-sublist', 'restaurant-group');
                restaurantLi.setAttribute('role', 'listitem');
                restaurantLi.setAttribute('tabindex', '0');
                restaurantLi.setAttribute('aria-expanded', 'false');
                restaurantLi.dataset.name = '餐廳';
                if (zoneClass) restaurantLi.classList.add(zoneClass);

                const restaurantSubUl = document.createElement('ul');
                restaurantSubUl.classList.add('sub-list', 'collapsed');
                restaurantSubUl.setAttribute('role', 'list');
                restaurantSubUl.setAttribute('aria-hidden', 'true');

                restaurantFacilities.forEach(facilt => {
                    restaurantSubUl.appendChild(createFacilityListItem(facilt));
                });

                restaurantLi.appendChild(restaurantSubUl);
                ul.appendChild(restaurantLi);
            }

            otherFacilities.forEach(facilt => {
                ul.appendChild(createFacilityListItem(facilt));
            });

            listContent.appendChild(categoryHeader);
            listContent.appendChild(ul);
        });
        updateCategoryVisibility();
    }

    function renderFilterButtons(categorizedFacilities) {
        filterButtonsContainer.innerHTML = '';
        const handleFilterClick = (clickedBtn) => {
            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-pressed', 'false');
            });
            clickedBtn.classList.add('active');
            clickedBtn.setAttribute('aria-pressed', 'true');
            const filterCategory = clickedBtn.getAttribute('data-filter');
            document.querySelectorAll('.category-header').forEach(header => {
                const category = header.getAttribute('data-category');
                const relatedList = header.nextElementSibling;
                const shouldShow = filterCategory === 'all' || category === filterCategory;
                header.style.display = shouldShow ? '' : 'none';
                header.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
                if (relatedList) {
                    relatedList.style.display = shouldShow ? '' : 'none';
                    relatedList.setAttribute('aria-hidden', shouldShow ? 'false' : 'true');
                }
            });
            refreshMapSize();
        };

        const btnAll = document.createElement('button');
        btnAll.textContent = '全部顯示';
        btnAll.classList.add('filter-btn', 'active');
        btnAll.setAttribute('data-filter', 'all');
        btnAll.setAttribute('aria-pressed', 'true');
        btnAll.addEventListener('click', () => handleFilterClick(btnAll));
        filterButtonsContainer.appendChild(btnAll);

        const sortedCategories = Object.keys(categorizedFacilities).sort((a, b) => {
            const orderA = categorySortOrder.indexOf(a);
            const orderB = categorySortOrder.indexOf(b);
            return (orderA === -1 ? 99 : orderA) - (orderB === -1 ? 99 : orderB);
        });
        sortedCategories.forEach(category => {
            const btn = document.createElement('button');
            btn.textContent = category.split(' ')[0];
            btn.classList.add('filter-btn');
            btn.setAttribute('data-filter', category);
            btn.setAttribute('aria-pressed', 'false');
            const zoneClass = zoneClassMap[category] || '';
            if (zoneClass) btn.classList.add(zoneClass);
            btn.addEventListener('click', () => handleFilterClick(btn));
            filterButtonsContainer.appendChild(btn);
        });
    }

    const updateCategoryVisibility = () => {
        document.querySelectorAll('#list-content > ul').forEach(ul => {
            const allHidden = [...ul.children].every(li => li.style.display === 'none');
            const header = ul.previousElementSibling;
            if (header && header.tagName === 'H3') {
                header.style.display = allHidden ? 'none' : '';
                header.setAttribute('aria-hidden', allHidden ? 'true' : 'false');
            }
            ul.setAttribute('aria-hidden', allHidden ? 'true' : 'false');
        });
    };

    searchBox.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase().trim();
        document.querySelectorAll('#list-content > ul > li').forEach(li => {
            const name = (li.dataset.name || '').toLowerCase();
            let shouldShow = name.includes(searchTerm);
            if (!shouldShow && li.classList.contains('has-sublist')) {
                const subItems = [...li.querySelectorAll('.sub-list li')];
                shouldShow = subItems.some(subLi => (subLi.dataset.fullName || '').toLowerCase().includes(searchTerm));
                if (shouldShow) {
                    li.classList.add('expanded');
                    const sublist = li.querySelector('.sub-list');
                    if (sublist) {
                        sublist.classList.remove('collapsed');
                        sublist.setAttribute('aria-hidden', 'false');
                    }
                    li.setAttribute('aria-expanded', 'true');
                }
            }
            li.style.display = shouldShow || !searchTerm ? '' : 'none';
            if (!searchTerm && li.classList.contains('has-sublist')) {
                li.classList.remove('expanded');
                const sublist = li.querySelector('.sub-list');
                if (sublist) {
                    sublist.classList.add('collapsed');
                    sublist.setAttribute('aria-hidden', 'true');
                }
                li.setAttribute('aria-expanded', 'false');
            }
        });
        updateCategoryVisibility();
    });

    const focusFacility = (targetLi) => {
        const lat = targetLi.getAttribute('data-lat');
        const lng = targetLi.getAttribute('data-lng');
        if (lat && lng) {
            let name = targetLi.getAttribute('data-parent-name') || targetLi.dataset.name || targetLi.textContent.trim();
            if (targetLi.getAttribute('data-parent-name')) name += ` - ${targetLi.textContent.trim()}`;
            if (marker) map.removeLayer(marker);
            map.setView([lat, lng], 18);
            marker = L.marker([lat, lng]).addTo(map).bindPopup(name).openPopup();
            if (isMobile()) toggleFacilityList(false);
        }
    };

    listContent.addEventListener('click', (e) => {
        if (e.target.classList.contains('category-header')) {
            const header = e.target;
            const relatedList = header.nextElementSibling;
            const isCollapsed = header.classList.toggle('collapsed');
            const shouldExpand = !isCollapsed;
            if (relatedList) {
                relatedList.classList.toggle('collapsed', !shouldExpand);
                relatedList.setAttribute('aria-hidden', (!shouldExpand).toString());
            }
            header.setAttribute('aria-expanded', shouldExpand.toString());
            return;
        }
        const targetLi = e.target.closest('li');
        if (!targetLi) return;
        if (targetLi.classList.contains('has-sublist')) {
            targetLi.classList.toggle('expanded');
            const sublist = targetLi.querySelector('.sub-list');
            if (sublist) {
                const isExpanded = !sublist.classList.toggle('collapsed');
                sublist.setAttribute('aria-hidden', (!isExpanded).toString());
                targetLi.setAttribute('aria-expanded', isExpanded.toString());
            }
            return;
        }
        focusFacility(targetLi);
    });

    listContent.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        if (e.target.closest('.menu-trigger')) return;
        if (e.target.classList.contains('category-header') || e.target.closest('li')) {
            e.preventDefault();
            e.target.click();
        }
    });

    mobileListToggle.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            toggleFacilityList(false);
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key !== 'Escape') return;
        if (menuModal.classList.contains('visible')) {
            hideMenuModal();
            return;
        }
        if (facilityList.classList.contains('open') && isMobile()) {
            toggleFacilityList(false);
        }
    });

    let previousMobileState = isMobile();
    if (previousMobileState) {
        applyMobileState(false);
        mobileListToggle.hidden = false;
    } else {
        resetDesktopState();
        mobileListToggle.hidden = true;
    }

    const handleResize = () => {
        const currentlyMobile = isMobile();
        updateAttributionPosition();
        if (currentlyMobile !== previousMobileState) {
            previousMobileState = currentlyMobile;
            if (currentlyMobile) {
                mobileListToggle.hidden = false;
                applyMobileState(false);
            } else {
                mobileListToggle.hidden = true;
                resetDesktopState();
            }
        } else if (currentlyMobile) {
            facilityList.setAttribute('aria-hidden', (!facilityList.classList.contains('open')).toString());
        }
        refreshMapSize();
    };

    window.addEventListener('resize', handleResize);
});
