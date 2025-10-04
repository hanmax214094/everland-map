document.addEventListener('DOMContentLoaded', () => {

    L.Icon.Default.imagePath = 'vendor/leaflet/images/';

    const map = L.map('map').setView([37.295, 127.204], 15);
    let marker = null;
    let userLocationMarker = null;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const LocateControl = L.Control.extend({
        options: { position: 'topleft' },
        onAdd: function (map) {
            const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control leaflet-control-custom leaflet-control-locate');
            container.innerHTML = '<a href="#" title="我的位置"></a>';
            container.onclick = (e) => {
                e.preventDefault();
                map.locate({ setView: true, maxZoom: 16 });
            };
            return container;
        }
    });
    map.addControl(new LocateControl());

    map.on('locationfound', (e) => {
        const radius = e.accuracy / 2;
        if (userLocationMarker) map.removeLayer(userLocationMarker);
        userLocationMarker = L.circle(e.latlng, radius).addTo(map);
        userLocationMarker.bindPopup(`您在這裡 (誤差約 ${radius.toFixed(0)} 公尺)`).openPopup();
    });

    map.on('locationerror', (e) => { alert(e.message); });

    const listContent = document.getElementById('list-content');
    const searchBox = document.getElementById('search-box');
    const filterButtonsContainer = document.getElementById('filter-buttons');

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
            console.error('Error fetching or parsing facility data:', error);
            listContent.innerHTML = '<p>無法載入設施資料。</p>';
        });

    function processData(facilities) {
        const groupedByCategory = {};
        facilities.forEach(facilt => {
            if (!facilt.locList || facilt.locList.length === 0) return;
            const zoneCode = facilt.zoneKindCd;
            const category = zoneMap[zoneCode] || '其他 (Others)';
            if (!groupedByCategory[category]) groupedByCategory[category] = {};
            let name = facilt.faciltNameCN || `${facilt.faciltNameEng} (${facilt.faciltName})`;
            if (!groupedByCategory[category][name]) {
                groupedByCategory[category][name] = { name: name, locations: [] };
            }
            facilt.locList.forEach(loc => {
                groupedByCategory[category][name].locations.push({ coords: [parseFloat(loc.latud), parseFloat(loc.lgtud)] });
            });
        });
        const finalGrouped = {};
        for (const category in groupedByCategory) {
            finalGrouped[category] = Object.values(groupedByCategory[category]).sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
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
            const ul = document.createElement('ul');
            ul.setAttribute('data-category', category);
            categorizedFacilities[category].forEach(facilt => {
                const li = document.createElement('li');
                li.textContent = facilt.name;
                if (zoneClass) li.classList.add(zoneClass);
                if (facilt.locations.length > 1) {
                    li.classList.add('has-sublist');
                    const subUl = document.createElement('ul');
                    subUl.classList.add('sub-list', 'collapsed');
                    facilt.locations.forEach((loc, index) => {
                        const subLi = document.createElement('li');
                        subLi.textContent = `地點 ${index + 1}`;
                        subLi.setAttribute('data-lat', loc.coords[0]);
                        subLi.setAttribute('data-lng', loc.coords[1]);
                        subLi.setAttribute('data-parent-name', facilt.name);
                        if (zoneClass) subLi.classList.add(zoneClass);
                        subUl.appendChild(subLi);
                    });
                    li.appendChild(subUl);
                } else {
                    li.setAttribute('data-lat', facilt.locations[0].coords[0]);
                    li.setAttribute('data-lng', facilt.locations[0].coords[1]);
                }
                ul.appendChild(li);
            });
            listContent.appendChild(categoryHeader);
            listContent.appendChild(ul);
        });
    }

    function renderFilterButtons(categorizedFacilities) {
        filterButtonsContainer.innerHTML = '';
        const handleFilterClick = (clickedBtn) => {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            clickedBtn.classList.add('active');
            const filterCategory = clickedBtn.getAttribute('data-filter');
            document.querySelectorAll('[data-category]').forEach(el => {
                el.style.display = (filterCategory === 'all' || el.getAttribute('data-category') === filterCategory) ? '' : 'none';
            });
        };
        const btnAll = document.createElement('button');
        btnAll.textContent = '全部顯示';
        btnAll.classList.add('filter-btn', 'active');
        btnAll.setAttribute('data-filter', 'all');
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
            const zoneClass = zoneClassMap[category] || '';
            if (zoneClass) btn.classList.add(zoneClass);
            btn.addEventListener('click', () => handleFilterClick(btn));
            filterButtonsContainer.appendChild(btn);
        });
    }

    searchBox.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        document.querySelectorAll('#list-content > ul > li').forEach(li => {
            const name = li.firstChild.textContent.toLowerCase();
            li.style.display = name.includes(searchTerm) ? '' : 'none';
        });
        document.querySelectorAll('#list-content > ul').forEach(ul => {
            const allHidden = [...ul.children].every(li => li.style.display === 'none');
            const header = ul.previousElementSibling;
            if (header && header.tagName === 'H3') {
                header.style.display = allHidden ? 'none' : '';
            }
        });
    });

    listContent.addEventListener('click', (e) => {
        // Handle category header clicks first
        if (e.target.classList.contains('category-header')) {
            e.target.classList.toggle('collapsed');
            e.target.nextElementSibling.classList.toggle('collapsed');
            return;
        }

        const targetLi = e.target.closest('li');
        if (!targetLi) return;

        // Handle expanding/collapsing a sublist
        if (targetLi.classList.contains('has-sublist') && e.target.closest('.sub-list') === null) {
            targetLi.classList.toggle('expanded');
            const sublist = targetLi.querySelector('.sub-list');
            if (sublist) sublist.classList.toggle('collapsed');
            return;
        }

        // Handle focusing the map
        const lat = targetLi.getAttribute('data-lat');
        const lng = targetLi.getAttribute('data-lng');
        if (lat && lng) {
            let name = targetLi.getAttribute('data-parent-name') || targetLi.textContent;
            if (targetLi.getAttribute('data-parent-name')) {
                name += ` - ${targetLi.textContent}`;
            }
            if (marker) map.removeLayer(marker);
            map.setView([lat, lng], 18);
            marker = L.marker([lat, lng]).addTo(map).bindPopup(name).openPopup();
        }
    });
});