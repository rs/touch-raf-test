const chartContainer = document.getElementById("chart-container");
const chart = document.getElementById("chart");
const tap = document.getElementById("app-container");

const TIME_MARGIN = 10;
let timeScale = 4;
let lastRafActual = 0;
let lastRafEvent = 0;
let lastDefoldUpdate = 0;
let lastDefoldFixedUpdate = 0;
let needsRerender = false;
const events = [
    "pointerdown",
    "pointermove",
    "pointerrawupdate",
    "pointerup",
    "defoldpress",
    "defoldmove",
    "defoldrelease",
];
const totalEvents = events.length;
const sessionEventLog = {};
let isSessionActive = false;
let sessionEndTimer = null;
for (const event of events) {
    const top = `${(events.indexOf(event) / totalEvents) * 100}%`;
    const eventDiv = document.createElement("div");
    eventDiv.className = `label`;
    eventDiv.style.top = top;
    eventDiv.textContent = event;
    chartContainer.appendChild(eventDiv);
}
function startSession() {
    sessionEventLog.raf = [{ actual: lastRafActual, event: lastRafEvent }];
    sessionEventLog.defold = {
        update: [lastDefoldUpdate],
        ["fixed-update"]: [lastDefoldFixedUpdate],
    };
    for (const event of events) {
        sessionEventLog[event] = [];
        sessionEventLog[event] = [];
    }
    isSessionActive = true;
}

function endSession() {
    if (!isSessionActive) {
        return;
    }
    isSessionActive = false;
    if (sessionEndTimer) {
        clearTimeout(sessionEndTimer);
        sessionEndTimer = null;
    }
    renderSession();
}

function renderSession() {
    while (chart.firstChild) {
        chart.removeChild(chart.firstChild);
    }

    const start = sessionEventLog.raf[0].actual - TIME_MARGIN;
    const end =
        sessionEventLog.raf[sessionEventLog.raf.length - 1].event +
        TIME_MARGIN;
    const duration = end - start;

    for (const raf of sessionEventLog.raf) {
        const rafTimeDiv = document.createElement("div");
        rafTimeDiv.className = `raf time`;
        rafTimeDiv.style.left = `${(raf.actual - start) * timeScale}px`;
        rafTimeDiv.textContent = `${Math.round(raf.actual - start)}ms`;
        chart.appendChild(rafTimeDiv);
        for (const type of ["actual", "event"]) {
            const rafDiv = document.createElement("div");
            rafDiv.className = `raf ${type}`;
            rafDiv.style.left = `${(raf[type] - start) * timeScale}px`;
            chart.appendChild(rafDiv);
        }
    }

    for (const type of ["fixed-update", "update"]) {
        for (const defoldUpdate of sessionEventLog.defold[type]) {
            if (type === "update") {
                const defoldDiv = document.createElement("div");
                defoldDiv.className = `defold time`;
                defoldDiv.style.left = `${(defoldUpdate - start) * timeScale}px`;
                defoldDiv.textContent = `${Math.round(defoldUpdate - start)}ms`;
                chart.appendChild(defoldDiv);
            }
            const defoldDiv = document.createElement("div");
            defoldDiv.className = `defold ${type}`;
            defoldDiv.style.left = `${(defoldUpdate - start) * timeScale}px`;
            chart.appendChild(defoldDiv);
        }
    }

    for (const event of events) {
        const top = `${(events.indexOf(event) / totalEvents) * 100}%`;
        const totalTouches = sessionEventLog[event].length;
        for (const touch of sessionEventLog[event]) {
            if (touch.actual) {
                const linkDiv = document.createElement("div");
                linkDiv.className = `touch-link`;
                linkDiv.style.top = top;
                linkDiv.style.left = `${(touch.actual - start) * timeScale}px`;
                linkDiv.style.width = `${(touch.event - touch.actual) * timeScale
                    }px`;
                chart.appendChild(linkDiv);
            }
            for (const type of ["actual", "event"]) {
                if (!touch[type]) {
                    continue;
                }
                const eventDiv = document.createElement("div");
                eventDiv.className = `touch ${type} ${event}`;
                eventDiv.style.top = top;
                eventDiv.style.left = `${(touch[type] - start) * timeScale}px`;
                chart.appendChild(eventDiv);
            }
            const timeDiv = document.createElement("div");
            timeDiv.className = `touch time`;
            timeDiv.style.top = top;
            timeDiv.style.left = `${(touch.event - start) * timeScale}px`;
            timeDiv.textContent = `${Math.round(touch.event - start)}ms`;
            chart.appendChild(timeDiv);
        }
    }
}

requestAnimationFrame(function rAF(time) {
    lastRafEvent = performance.now();
    lastRafActual = time;
    if (isSessionActive) {
        sessionEventLog.raf.push({ event: lastRafEvent, actual: time });
    }
    if (needsRerender) {
        needsRerender = false;
        renderSession();
    }
    requestAnimationFrame(rAF);
});

function handleSessionStartStop(event) {
    if (event === "pointerdown" || event === "defoldpress") {
        if (!isSessionActive) {
            startSession();
        }
    } else if (event === "pointerup" || event === "defoldrelease") {
        if (sessionEndTimer) {
            clearTimeout(sessionEndTimer);
        }
        sessionEndTimer = setTimeout(endSession, 20);
    }
}

for (const event of events) {
    if (event.startsWith("defold")) {
        continue;
    }
    tap.addEventListener(event, function(e) {
        handleSessionStartStop(event);
        if (isSessionActive) {
            const now = performance.now();
            sessionEventLog[event].push({ event: now, actual: e.timeStamp });
        }
    });
}

function onDefoldUpdate() {
    lastDefoldUpdate = performance.now();
    if (isSessionActive) {
        sessionEventLog.defold.update.push(lastDefoldUpdate);
    }
}

function onDefoldFixedUpdate() {
    lastDefoldFixedUpdate = performance.now();
    if (isSessionActive) {
        sessionEventLog.defold["fixed-update"].push(lastDefoldFixedUpdate);
    }
}

function onDefoldInput(pressed, released) {
    handleSessionStartStop(event);
    if (isSessionActive) {
        const event = pressed
            ? "defoldpress"
            : released
                ? "defoldrelease"
                : "defoldmove";
        sessionEventLog[event].push({ event: performance.now() });
    }
}

let pinchLastDistance = 0;

chartContainer.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
        pinchLastDistance = getDistance(e.touches[0], e.touches[1]);
        for (const touch of e.touches) {
            e.target.setPointerCapture(touch.identifier);
        }
    }
}, true);

chartContainer.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2) {
        e.preventDefault();
        const newDistance = getDistance(e.touches[0], e.touches[1]);
        const scaleChange = newDistance / pinchLastDistance;
        timeScale = Math.max(Math.min(timeScale * scaleChange, 20), 1);
        pinchLastDistance = newDistance;
        needsRerender = true;
    }
}, true);

function getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}
