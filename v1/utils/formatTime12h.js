function formatTime12h(value) {
    if (!value) return value;

    let hours;
    let minutes;

    if (value instanceof Date) {
        hours = value.getHours();
        minutes = value.getMinutes();
    } else if (typeof value === "string") {
        const match = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
        if (match) {
            hours = parseInt(match[1], 10);
            minutes = parseInt(match[2], 10);
        } else {
            const d = new Date(value);
            if (isNaN(d)) return value;
            hours = d.getHours();
            minutes = d.getMinutes();
        }
    } else {
        return value;
    }

    const period = hours >= 12 ? "P.M." : "A.M.";
    const hour12 = hours % 12 === 0 ? 12 : hours % 12;
    const mm = String(minutes).padStart(2, "0");

    return `${hour12}:${mm} ${period}`;
}

module.exports = formatTime12h;
