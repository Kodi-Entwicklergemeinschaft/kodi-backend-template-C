const openingHours = {
    2: {
        1: { open: "08:30", close: "16:00" },
        2: { open: "08:30", close: "16:00" },
        3: { open: "08:30", close: "12:00" },
        4: { open: "08:30", close: "18:00" },
        5: { open: "08:30", close: "12:00" },
        6: null,
        7: null
    },
    3: {
        1: { open: "08:30", close: "16:00" },
        2: { open: "08:30", close: "16:00" },
        3: { open: "08:30", close: "12:00" },
        4: { open: "08:30", close: "18:00" },
        5: { open: "08:30", close: "12:00" },
        6: null,
        7: null
    },
    4: {
        1: { open: "08:30", close: "16:00" },
        2: { open: "08:30", close: "16:00" },
        3: { open: "08:30", close: "16:00" },
        4: { open: "08:30", close: "18:00" },
        5: { open: "08:30", close: "12:00" },
        6: null,
        7: null
    }
};
  
module.exports.getOpeningHours = async (location, day) => {
    const loc = openingHours[location];
    if (!loc) {
        return null;
    }

    const hours = loc[day];
    if (hours === undefined) {
        return null;
    }

    if (hours === null) {
        return null;
    }

    return `${hours.close}`;
};
