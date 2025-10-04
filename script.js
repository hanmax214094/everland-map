document.addEventListener('DOMContentLoaded', () => {

    const map = L.map('map').setView([37.295, 127.204], 15);
    let marker = null;

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    const facilityList = document.getElementById('facility-list');

    // Mapping for zone codes to human-readable names
    const zoneMap = {
        '01': '環球集市 (Global Fair)',
        '02': '美洲冒險 (American Adventure)',
        '03': '魔術天地 (Magic Land)',
        '05': '歐洲冒險 (European Adventure)',
        '06': '動物王國 (Zootopia)',
        '12': '週邊設施 (Perimeter Facilities)',
        '99': '服務設施 (Services)'
    };

    // Fetch data and build the map
    fetch('./all_facilt.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            const categorizedFacilities = processData(data);
            renderList(categorizedFacilities);
        })
        .catch(error => {
            console.error('Error fetching or parsing facility data:', error);
            facilityList.innerHTML = '<p>無法載入設施資料，請確認 all_facilt.json 檔案是否存在。</p>';
        });

    function processData(facilities) {
        const grouped = {};

        facilities.forEach(facilt => {
            // Skip if no location data
            if (!facilt.locList || facilt.locList.length === 0) {
                return;
            }

            const zoneCode = facilt.zoneKindCd;
            const category = zoneMap[zoneCode] || '其他 (Others)';

            if (!grouped[category]) {
                grouped[category] = [];
            }

            // Determine the name based on the specified rule
            let name = facilt.faciltNameCN;
            if (!name || name.trim() === '') {
                name = `${facilt.faciltNameEng} (${facilt.faciltName})`;
            }

            // Add all locations for facilities that have multiple (like restrooms)
            facilt.locList.forEach(loc => {
                 grouped[category].push({
                    name: name,
                    coords: [parseFloat(loc.latud), parseFloat(loc.lgtud)]
                });
            });
        });
        
        // Sort facilities within each category alphabetically
        for (const category in grouped) {
            grouped[category].sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
        }

        return grouped;
    }

    function renderList(categorizedFacilities) {
        facilityList.innerHTML = ''; // Clear previous list

        // Sort categories based on the zoneMap order
        const sortedCategories = Object.keys(categorizedFacilities).sort((a, b) => {
            const orderA = Object.values(zoneMap).indexOf(a);
            const orderB = Object.values(zoneMap).indexOf(b);
            if (orderA === -1) return 1;
            if (orderB === -1) return -1;
            return orderA - orderB;
        });

        sortedCategories.forEach(category => {
            const categoryHeader = document.createElement('h3');
            categoryHeader.textContent = category;
            facilityList.appendChild(categoryHeader);

            const ul = document.createElement('ul');
            categorizedFacilities[category].forEach(facilt => {
                const li = document.createElement('li');
                li.textContent = facilt.name;
                li.setAttribute('data-lat', facilt.coords[0]);
                li.setAttribute('data-lng', facilt.coords[1]);
                ul.appendChild(li);
            });
            facilityList.appendChild(ul);
        });
    }

    // Event listener for clicks on the facility list
    facilityList.addEventListener('click', (event) => {
        if (event.target.tagName === 'LI') {
            const lat = parseFloat(event.target.getAttribute('data-lat'));
            const lng = parseFloat(event.target.getAttribute('data-lng'));
            const name = event.target.textContent;

            if (marker) {
                map.removeLayer(marker);
            }

            map.setView([lat, lng], 18);
            marker = L.marker([lat, lng]).addTo(map)
                .bindPopup(name)
                .openPopup();
        }
    });
});
