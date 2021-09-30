let helpers = {
    /**
     * @param {Number} pct
     * @returns {string}
     */
    percentageToColor(pct) {
        let percentColors = [
            {pct: 0.0, color: {r: 0xff, g: 0xff, b: 0xff}}, // White
            {pct: 0.25, color: {r: 0, g: 0xff, b: 0xff}}, // Cyan
            {pct: 0.5, color: {r: 0, g: 0xff, b: 0}}, // Green
            {pct: 0.75, color: {r: 0xff, g: 0xff, b: 0}}, // Yellow
            {pct: 1.0, color: {r: 0xff, g: 0, b: 0}}, // Red
        ];

        for (var i = 1; i < percentColors.length - 1; i++) {
            if (pct < percentColors[i].pct) {
                break;
            }
        }
        let lower = percentColors[i - 1];
        let upper = percentColors[i];
        let range = upper.pct - lower.pct;
        let rangePct = (pct - lower.pct) / range;
        let pctLower = 1 - rangePct;
        let pctUpper = rangePct;
        let color = {
            r: Math.floor(lower.color.r * pctLower + upper.color.r * pctUpper),
            g: Math.floor(lower.color.g * pctLower + upper.color.g * pctUpper),
            b: Math.floor(lower.color.b * pctLower + upper.color.b * pctUpper)
        };
        return 'rgb(' + [color.r, color.g, color.b].join(',') + ')';
    },

    /**
     * @param {Number} value
     * @param {Number} places
     * @returns {Number}
     */
    round(value, places= 0) {
        let multiplier = Math.pow(10, places);

        return (Math.round(value * multiplier) / multiplier);
    },

    /**
     * @param {Number} value
     * @param {Number} min
     * @param {Number} max
     * @param {Number} round
     * @returns {Number}
     */
    minmax(value, min, max, round = 3) {
        return helpers.round(((value - min) / (max - min)) || 0, round);
    },

    normalize(value, min, max, mean, round = 3) {
        return helpers.round(((value - mean) / (max - min)) || 0, round);
    }
}

module.exports = helpers;
