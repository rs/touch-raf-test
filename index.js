const chartContainer = document.getElementById("chart-container");
const chart = document.getElementById("chart");
const tap = document.getElementById("app-container");

let MARGIN_PX = 50;
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
    "jstodefpress",
    "jstodefmove",
    "jstodefrelease",
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
    chart.scrollTo(0, 0);
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

function sessionBoundaries() {
    const start = sessionEventLog.raf[0].actual;
    const end =
        sessionEventLog.raf[sessionEventLog.raf.length - 1].event;
    const duration = end - start;
    return { start, end, duration };
}

function renderSession() {
    while (chart.firstChild) {
        chart.removeChild(chart.firstChild);
    }

    const { start, end } = sessionBoundaries();

    for (const raf of sessionEventLog.raf) {
        const rafTimeDiv = document.createElement("div");
        rafTimeDiv.className = `raf time`;
        rafTimeDiv.style.left = `${((raf.actual - start) * timeScale) + MARGIN_PX}px`;
        rafTimeDiv.textContent = `${Math.round(raf.actual - start)}ms`;
        chart.appendChild(rafTimeDiv);
        for (const type of ["actual", "event"]) {
            const rafDiv = document.createElement("div");
            rafDiv.className = `raf ${type}`;
            rafDiv.style.left = `${((raf[type] - start) * timeScale) + MARGIN_PX}px`;
            chart.appendChild(rafDiv);
        }
    }

    for (const type of ["fixed-update", "update"]) {
        for (const defoldUpdate of sessionEventLog.defold[type]) {
            if (type === "update") {
                const defoldDiv = document.createElement("div");
                defoldDiv.className = `defold time`;
                defoldDiv.style.left = `${((defoldUpdate - start) * timeScale) + MARGIN_PX}px`;
                defoldDiv.textContent = `${Math.round(defoldUpdate - start)}ms`;
                chart.appendChild(defoldDiv);
            }
            const defoldDiv = document.createElement("div");
            defoldDiv.className = `defold ${type}`;
            defoldDiv.style.left = `${((defoldUpdate - start) * timeScale) + MARGIN_PX}px`;
            chart.appendChild(defoldDiv);
        }
    }

    for (const event of events) {
        const top = (events.indexOf(event) / totalEvents) * 100;
        const totalTouches = sessionEventLog[event].length;
        for (let i = 0; i < sessionEventLog[event].length; i++) {
            const touch = sessionEventLog[event][i];
            let touchTop = `${top}%`;
            if (event === "pointermove" || event === "pointerrawupdate" || event === "jstodefmove") {
                touchTop = `${top + (i % 2 === 0 ? -2 : 1.5)}%`;
            }
            if (touch.actual) {
                const linkDiv = document.createElement("div");
                linkDiv.className = 'touch link';
                linkDiv.style.top = touchTop;
                linkDiv.style.left = `${((touch.actual - start) * timeScale) + MARGIN_PX}px`;
                linkDiv.style.width = `${(touch.event - touch.actual) * timeScale
                    }px`;
                chart.appendChild(linkDiv);
            }
            for (const type of ["actual", "event"]) {
                if (!touch[type]) {
                    continue;
                }
                const eventDiv = document.createElement("div");
                eventDiv.className = `touch ${type} ${event} dot`;
                eventDiv.style.top = touchTop;
                eventDiv.style.left = `${((touch[type] - start) * timeScale) + MARGIN_PX}px`;
                chart.appendChild(eventDiv);

                if (type === 'event' || (touch.event - touch.actual) > 0) {
                    const timeDiv = document.createElement("div");
                    timeDiv.className = `touch ${type} time`;
                    timeDiv.style.top = touchTop;
                    timeDiv.style.left = `${((touch[type] - start) * timeScale) + MARGIN_PX}px`;
                    timeDiv.textContent = `${Math.round(touch[type] - start)}ms`;
                    chart.appendChild(timeDiv);
                }
            }
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
    if (event === "pointerdown" || event === "defoldpress" || event === "jstodefpress") {
        if (!isSessionActive) {
            startSession();
        }
    } else if (event === "pointerup" || event === "defoldrelease" || event === "jstodefrelease") {
        if (sessionEndTimer) {
            clearTimeout(sessionEndTimer);
        }
        sessionEndTimer = setTimeout(endSession, 20);
    }
}

for (const event of events) {
    if (event.startsWith("defold") || event.startsWith("jstodef")) {
        continue;
    }
    tap.addEventListener(event, function(e) {
        handleSessionStartStop(event);
        if (isSessionActive) {
            const now = performance.now();
            sessionEventLog[event].push({ event: now, actual: e.timeStamp });
        }

        if (["pointerdown", "pointermove", "pointerup"].includes(event)) {
            JsToDef.send(event, e.timeStamp);
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
    const event = pressed
        ? "defoldpress"
        : released
            ? "defoldrelease"
            : "defoldmove";
    handleSessionStartStop(event);
    if (isSessionActive) {
        sessionEventLog[event].push({ event: performance.now() });
    }
}

function onJsToDefInput(pressed, released, actual) {
    const event = pressed
        ? "jstodefpress"
        : released
            ? "jstodefrelease"
            : "jstodefmove";
    handleSessionStartStop(event);
    if (isSessionActive) {
        sessionEventLog[event].push({ event: performance.now(), actual });
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
        const prevTimeScale = timeScale;
        timeScale = Math.max(Math.min(timeScale * scaleChange, 20), 1);
        pinchLastDistance = newDistance;
        needsRerender = true;

        // Keep the zoomed area centered
        const centerBeforeZoom = chart.scrollLeft + chart.clientWidth / 2;
        const centerTimeBeforeZoom = centerBeforeZoom / prevTimeScale;
        const centerAfterZoom = centerTimeBeforeZoom * timeScale;
        chart.scrollLeft = centerAfterZoom - chart.clientWidth / 2;
    }
}, true);

function getDistance(touch1, touch2) {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
}
