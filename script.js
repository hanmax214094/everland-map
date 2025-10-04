const DEFAULT_PDF_URL = "https://www.everland.com/static/files/chnt_everland.pdf";
const MIN_LABEL_LENGTH = 2;
const SCALE_STEP = 0.2;
const MIN_SCALE = 0.6;
const MAX_SCALE = 2.6;

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.6.172/pdf.worker.min.js";

const elements = {
  canvas: document.getElementById("pdfCanvas"),
  textLayer: document.getElementById("textLayer"),
  highlightLayer: document.getElementById("highlightLayer"),
  facilityList: document.getElementById("facilityList"),
  searchInput: document.getElementById("searchInput"),
  status: document.getElementById("statusMessage"),
  reloadDefault: document.getElementById("reloadDefault"),
  pdfFileInput: document.getElementById("pdfFileInput"),
  pdfUrlInput: document.getElementById("pdfUrlInput"),
  loadFromUrl: document.getElementById("loadFromUrl"),
  zoomIn: document.getElementById("zoomIn"),
  zoomOut: document.getElementById("zoomOut"),
  zoomLevel: document.getElementById("zoomLevel"),
  mapContainer: document.getElementById("mapContainer"),
};

let pdfDoc = null;
let currentScale = 1.4;
let currentPage = null;
let viewport = null;
let facilityIndex = new Map();
let orderedFacilityNames = [];
let activeFacility = null;
let lastSource = DEFAULT_PDF_URL;

async function loadPdf(source) {
  try {
    elements.status.textContent = "載入地圖中…";
    facilityIndex.clear();
    orderedFacilityNames = [];
    renderFacilityList([]);
    clearHighlights();

    pdfDoc = await pdfjsLib.getDocument(source).promise;
    lastSource = source;
    await renderCurrentScale();
    elements.status.textContent = "完成載入，可搜尋或點選左側清單。";
  } catch (error) {
    console.error(error);
    const hint =
      source === DEFAULT_PDF_URL
        ? "（可能是原始網站暫時無法連線或需要透過代理）"
        : "（請確認網址是否支援跨來源存取，或改用本機檔案）";
    elements.status.textContent = `載入失敗：${error.message} ${hint}`;
  }
}

async function renderCurrentScale() {
  if (!pdfDoc) return;
  currentPage = await pdfDoc.getPage(1);
  viewport = currentPage.getViewport({ scale: currentScale });
  await renderPage();
}

async function renderPage() {
  const context = elements.canvas.getContext("2d");
  elements.canvas.width = viewport.width;
  elements.canvas.height = viewport.height;
  elements.canvas.style.width = `${viewport.width}px`;
  elements.canvas.style.height = `${viewport.height}px`;
  elements.textLayer.style.width = `${viewport.width}px`;
  elements.textLayer.style.height = `${viewport.height}px`;
  elements.highlightLayer.style.width = `${viewport.width}px`;
  elements.highlightLayer.style.height = `${viewport.height}px`;

  await currentPage.render({
    canvasContext: context,
    viewport,
  }).promise;

  await buildFacilityIndex();
  updateZoomLabel();
}

async function buildFacilityIndex() {
  const textContent = await currentPage.getTextContent({ normalizeWhitespace: true });
  elements.textLayer.innerHTML = "";

  const textLayerRenderTask = pdfjsLib.renderTextLayer({
    textContent,
    container: elements.textLayer,
    viewport,
    textDivs: [],
    enhanceTextSelection: false,
  });

  await textLayerRenderTask.promise;

  facilityIndex.clear();

  const textDivs = Array.from(elements.textLayer.querySelectorAll("span"));
  const containerRect = elements.textLayer.getBoundingClientRect();

  for (const div of textDivs) {
    const label = div.textContent.trim();
    if (!label || label.length < MIN_LABEL_LENGTH) continue;

    const rect = div.getBoundingClientRect();
    const box = {
      left: rect.left - containerRect.left,
      top: rect.top - containerRect.top,
      width: rect.width,
      height: rect.height,
    };

    if (!facilityIndex.has(label)) {
      facilityIndex.set(label, []);
    }
    facilityIndex.get(label).push(box);
  }

  orderedFacilityNames = Array.from(facilityIndex.keys()).sort((a, b) =>
    a.localeCompare(b, "zh-Hant", { sensitivity: "base" })
  );

  renderFacilityList(orderedFacilityNames);
}

function renderFacilityList(entries) {
  elements.facilityList.innerHTML = "";

  if (!entries.length) {
    const emptyState = document.createElement("div");
    emptyState.className = "empty-state";
    emptyState.textContent = "目前沒有可顯示的標籤。";
    elements.facilityList.append(emptyState);
    return;
  }

  const fragment = document.createDocumentFragment();

  for (const name of entries) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "facility-item" + (name === activeFacility ? " active" : "");
    button.textContent = name;
    button.title = name;
    button.addEventListener("click", () => {
      handleFacilitySelect(name);
    });
    fragment.append(button);
  }

  elements.facilityList.append(fragment);
}

function handleFacilitySelect(name) {
  activeFacility = name;
  renderFacilityList(currentFilteredFacilities());

  const boxes = facilityIndex.get(name);
  if (!boxes || !boxes.length) {
    elements.status.textContent = `找不到「${name}」的座標。`;
    return;
  }

  showHighlights(boxes);
  elements.status.textContent = `已標出「${name}」。`;
}

function showHighlights(boxes) {
  clearHighlights();

  const fragment = document.createDocumentFragment();
  boxes.forEach((box, index) => {
    const marker = document.createElement("div");
    marker.className = "highlight-box";
    marker.style.left = `${box.left}px`;
    marker.style.top = `${box.top}px`;
    marker.style.width = `${box.width}px`;
    marker.style.height = `${box.height}px`;
    fragment.append(marker);

    if (index === 0) {
      scrollToBox(box);
    }
  });

  elements.highlightLayer.append(fragment);
}

function clearHighlights() {
  elements.highlightLayer.innerHTML = "";
}

function scrollToBox(box) {
  const container = elements.mapContainer;
  const targetLeft = Math.max(box.left + box.width / 2 - container.clientWidth / 2, 0);
  const targetTop = Math.max(box.top + box.height / 2 - container.clientHeight / 2, 0);

  container.scrollTo({
    left: targetLeft,
    top: targetTop,
    behavior: "smooth",
  });
}

function currentFilteredFacilities() {
  const query = elements.searchInput.value.trim();
  if (!query) return orderedFacilityNames;
  const normalizedQuery = query.toLocaleLowerCase();
  return orderedFacilityNames.filter((name) =>
    name.toLocaleLowerCase().includes(normalizedQuery)
  );
}

function updateZoomLabel() {
  elements.zoomLevel.textContent = `${Math.round(currentScale * 100)}%`;
}

function applySearchFilter() {
  const entries = currentFilteredFacilities();
  renderFacilityList(entries);
  if (!entries.includes(activeFacility)) {
    clearHighlights();
    activeFacility = null;
  }
}

function changeScale(delta) {
  const nextScale = Math.min(Math.max(currentScale + delta, MIN_SCALE), MAX_SCALE);
  if (nextScale === currentScale) return;
  currentScale = nextScale;
  renderCurrentScale();
}

elements.reloadDefault.addEventListener("click", () => {
  loadPdf(DEFAULT_PDF_URL);
});

elements.pdfFileInput.addEventListener("change", (event) => {
  const file = event.target.files?.[0];
  if (!file) return;
  const fileUrl = URL.createObjectURL(file);
  loadPdf({ url: fileUrl });
});

elements.loadFromUrl.addEventListener("click", () => {
  const url = elements.pdfUrlInput.value.trim();
  if (!url) return;
  loadPdf(url);
});

elements.searchInput.addEventListener("input", applySearchFilter);

elements.zoomIn.addEventListener("click", () => changeScale(SCALE_STEP));

elements.zoomOut.addEventListener("click", () => changeScale(-SCALE_STEP));

window.addEventListener("resize", () => {
  if (!viewport) return;
  // Re-render at the current scale to keep coordinate mapping accurate.
  renderCurrentScale();
});

loadPdf(DEFAULT_PDF_URL);
