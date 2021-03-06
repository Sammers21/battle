class Point {
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }
}

class Hex {
    constructor(q, r, s) {
        this.q = q;
        this.r = r;
        this.s = s;

        if (Math.round(q + r + s) !== 0)
            throw new Error("(q + r + s) in Hex must be zero");
    }

    add(hex) {
        return new Hex(this.q + hex.q, this.r + hex.r, this.s + hex.s);
    }

    subtract(hex) {
        return new Hex(this.q - hex.q, this.r - hex.r, this.s - hex.s);
    }

    multiply(koef) {
        return new Hex(this.q * koef, this.r * koef, this.s * koef);
    }

    length() {
        return (Math.abs(this.q) + Math.abs(this.r) + Math.abs(this.s)) / 2;
    }

    distance(hex) {
        return this.subtract(hex).length();
    }

    static direction(direction) {
        return Hex.directions[direction];
    }

    neighbor(direction) {
        return this.add(Hex.direction(direction));
    }

    round() {
        let qi = Math.round(this.q),
            ri = Math.round(this.r),
            si = Math.round(this.s);

        let q_diff = Math.abs(qi - this.q),
            r_diff = Math.abs(ri - this.r),
            s_diff = Math.abs(si - this.s);

        if (q_diff > r_diff && q_diff > s_diff)
            qi = -ri - si;
        else if (r_diff > s_diff)
            ri = -qi - si;
        else
            si = -qi - ri;

        return new Hex(qi, ri, si);
    }
}

Hex.directions = [
    new Hex(1, 0, -1),
    new Hex(1, -1, 0),
    new Hex(0, -1, 1),
    new Hex(-1, 0, 1),
    new Hex(-1, 1, 0),
    new Hex(0, 1, -1)
];

Hex.prototype.toString = function () {
    if (this.q === -0) this.q = 0
    if (this.s === -0) this.s = 0
    if (this.r === -0) this.r = 0
    return this.q + " " + this.r + " " + this.s;
}

class Orientation {
    constructor(f0, f1, f2, f3, b0, b1, b2, b3, start_angle) {
        this.f0 = f0;
        this.f1 = f1;
        this.f2 = f2;
        this.f3 = f3;
        this.b0 = b0;
        this.b1 = b1;
        this.b2 = b2;
        this.b3 = b3;
        this.start_angle = start_angle;
    }
}

class Layout {
    constructor(orientation, size, origin) {
        this.orientation = orientation;
        this.size = size;
        this.origin = origin;
    }

    hexToPixel(hex) {
        const x = (this.orientation.f0 * hex.q + this.orientation.f1 * hex.r)
            * this.size.x;
        const y = (this.orientation.f2 * hex.q + this.orientation.f3 * hex.r)
            * this.size.y;

        return new Point(x + this.origin.x, y + this.origin.y)
    }

    pixelToHex(p) {
        const pt = new Point(
            (p.x - this.origin.x) / this.size.x,
            (p.y - this.origin.y) / this.size.y
        );
        const q = this.orientation.b0 * pt.x + this.orientation.b1 * pt.y,
            r = this.orientation.b2 * pt.x + this.orientation.b3 * pt.y;

        return new Hex(q, r, -q - r)
    }

    hexCornerOffset(corner) {
        const angle = 2.0 * Math.PI * (this.orientation.start_angle - corner) / 6.0;

        return new Point(
            this.size.x * Math.cos(angle),
            this.size.y * Math.sin(angle)
        )
    }

    polygonCorners(h) {
        let corners = [];
        const center = this.hexToPixel(h);

        for (let i = 0; i < 6; i++) {
            let offset = this.hexCornerOffset(i);
            corners.push(new Point(center.x + offset.x, center.y + offset.y));
        }

        return corners
    }

    insideHex(point, corners) {
        const x = point.x, y = point.y;

        let inside = false;
        for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
            let xi = corners[i].x, yi = corners[i].y;
            let xj = corners[j].x, yj = corners[j].y;

            let intersect = ((yi > y) != (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }

        return inside
    }

    getHexRange(activeHex, hexes, range) {
        let results = [];

        for (let i = 0; i < hexes.length; i++) {
            let hex = hexes[i]

            if (
                (hex.q >= (activeHex.q - range) && hex.q <= (activeHex.q + range)) &&
                (hex.r >= (activeHex.r - range) && hex.r <= (activeHex.r + range)) &&
                (hex.s >= (activeHex.s - range) && hex.s <= (activeHex.s + range))
            ) results.push(hex)
        }

        return results
    }

    getReachableHex(activeHex, movement, obstackles, friendlyUnits) {
        let fringes = [],
            cost_so_far = {},
            came_from = {};

        cost_so_far[activeHex] = 0;
        came_from[activeHex] = null;
        fringes.push([activeHex])

        for (let i = 1; i <= movement; i++) {
            fringes.push([]);

            fringes[i - 1].forEach(hex => {
                for (let j = 0; j < 6; j++) {
                    let neighbor = hex.neighbor(j)
                    if (
                        !this.isObstacle(neighbor, obstackles) &&
                        !this.isObstacle(neighbor, friendlyUnits) &&
                        cost_so_far[neighbor] === undefined &&
                        !this.isOutsideBorders(neighbor)
                    ) {
                        cost_so_far[neighbor] = i;
                        came_from[neighbor] = hex;
                        fringes[i].push(neighbor)
                    }
                }
            });
        }

        return { fringes: fringes, came_from: came_from };
    }

    isObstacle(hex, obstackles) {
        for (const obstackle of obstackles)
            if (hex.toString() === obstackle.toString()) return true;

        return false;
    }

    isOutsideBorders(hex) {
        if (hex.r < -5 || hex.r > 5) return true;
        if (Math.abs(hex.q) + Math.abs(hex.s) > 15) return true;

        switch (hex.r) {
            case -5: if (hex.s > 9) return true; break;
            case -3: if (hex.s > 8) return true; break;
            case -1: if (hex.s > 7) return true; break;
            case 1: if (hex.s > 6) return true; break;
            case 3: if (hex.s > 5) return true; break;
            case 5: if (hex.s > 4) return true; break;
            default: return false;
        }
    }
}

Layout.pointy = new Orientation(Math.sqrt(3.0), Math.sqrt(3.0) / 2.0, 0.0, 3.0 / 2.0, Math.sqrt(3.0) / 3.0, -1.0 / 3.0, 0.0, 2.0 / 3.0, 0.5);
