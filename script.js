document.addEventListener('DOMContentLoaded', () => {

    // Set Leaflet's default icon path
    L.Icon.Default.imagePath = 'vendor/leaflet/images/';

    const map = L.map('map').setView([37.295, 127.204], 15);
    let marker = null;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

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

    // Explicitly define the category sort order
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
        const grouped = {};
        facilities.forEach(facilt => {
            if (!facilt.locList || facilt.locList.length === 0) return;
            const zoneCode = facilt.zoneKindCd;
            const category = zoneMap[zoneCode] || '其他 (Others)';
            if (!grouped[category]) {
                grouped[category] = [];
            }
            let name = facilt.faciltNameCN || `${facilt.faciltNameEng} (${facilt.faciltName})`;
            facilt.locList.forEach(loc => {
                grouped[category].push({ name: name, coords: [parseFloat(loc.latud), parseFloat(loc.lgtud)] });
            });
        });
        for (const category in grouped) {
            grouped[category].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
        }
        return grouped;
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
                li.setAttribute('data-lat', facilt.coords[0]);
                li.setAttribute('data-lng', facilt.coords[1]);
                if (zoneClass) li.classList.add(zoneClass);
                ul.appendChild(li);
            });
            listContent.appendChild(categoryHeader);
            listContent.appendChild(ul);
        });
    }

    function renderFilterButtons(categorizedFacilities) {
        filterButtonsContainer.innerHTML = ''; // Clear existing buttons
        
        const handleFilterClick = (clickedBtn) => {
            document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
            clickedBtn.classList.add('active');
            const filterCategory = clickedBtn.getAttribute('data-filter');
            document.querySelectorAll('[data-category]').forEach(el => {
                if (filterCategory === 'all' || el.getAttribute('data-category') === filterCategory) {
                    el.style.display = '';
                } else {
                    el.style.display = 'none';
                }
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
        document.querySelectorAll('#list-content li').forEach(li => {
            const name = li.textContent.toLowerCase();
            li.style.display = name.includes(searchTerm) ? '' : 'none';
        });
        document.querySelectorAll('#list-content ul').forEach(ul => {
            const allHidden = [...ul.children].every(li => li.style.display === 'none');
            const header = ul.previousElementSibling;
            if (header && header.tagName === 'H3') {
                header.style.display = allHidden ? 'none' : '';
            }
        });
    });

    listContent.addEventListener('click', (e) => {
        if (e.target.classList.contains('category-header')) {
            e.target.classList.toggle('collapsed');
            e.target.nextElementSibling.classList.toggle('collapsed');
        }
    });

    listContent.addEventListener('click', (event) => {
        if (event.target.tagName === 'LI') {
            const lat = parseFloat(event.target.getAttribute('data-lat'));
            const lng = parseFloat(event.target.getAttribute('data-lng'));
            const name = event.target.textContent;
            if (marker) map.removeLayer(marker);
            map.setView([lat, lng], 18);
            marker = L.marker([lat, lng]).addTo(map).bindPopup(name).openPopup();
        }
    });
});