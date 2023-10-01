/* 
Tool Cool Color Picker
Version: 1.0.14
Documentation: https://github.com/mzusin/toolcool-color-picker
Author: Miriam Zusin
License: MIT License                                   
*/
(() => {
    var Mt = Object.defineProperty;
    var kt = (o, e, t) =>
        e in o
            ? Mt(o, e, {
                  enumerable: !0,
                  configurable: !0,
                  writable: !0,
                  value: t,
              })
            : (o[e] = t);
    var h = (o, e, t) => (kt(o, typeof e != "symbol" ? e + "" : e, t), t);
    var ot =
        ":root{--tool-cool-color-picker-btn-bg:#fff;--tool-cool-color-picker-btn-border-color:#cecece;--tool-cool-color-picker-btn-border-color-inner:#626262;--tool-cool-color-picker-btn-border-radius:.25rem;--tool-cool-color-picker-btn-border-radius-inner:0}.color-picker{position:relative}.button{width:3rem;height:1.5rem;padding:.25rem;background:var(--tool-cool-color-picker-btn-bg,#fff);border-radius:var(--tool-cool-color-picker-btn-border-radius,0.25rem);border-width:1px;border-style:solid;border-color:var(--tool-cool-color-picker-btn-border-color,#cecece);cursor:pointer;box-sizing:border-box}.button-color{display:block;width:100%;height:100%;border-width:1px;border-style:solid;border-color:var(--tool-cool-color-picker-btn-border-color-inner,#626262);background:#000;box-sizing:border-box;border-radius:var(--tool-cool-color-picker-btn-border-radius-inner,0)}";
    var it =
        ":root{--tool-cool-color-picker-popup-bg:#fff;--tool-cool-color-picker-popup-border-color:#cecece;--tool-cool-color-picker-popup-width:214px}.popup{position:absolute;left:0;top:calc(100% - 1px);z-index:50;width:var(--tool-cool-color-picker-popup-width,214px);box-shadow:0 1px 3px 0 rgba(0,0,0,0.1),0 1px 2px -1px rgba(0,0,0,0.1);padding:.5rem;background:var(--tool-cool-color-picker-popup-bg,#fff);border-width:1px;border-style:solid;border-color:var(--tool-cool-color-picker-popup-border-color,#cecece);border-radius:.25rem}.popup.right{right:0;left:auto}";
    var rt =
        ".saturation{touch-action:none;overflow:hidden;width:100%;height:9rem;position:relative}.box{width:100%;height:100%;position:absolute}.white{background:linear-gradient(90deg,#fff,hsla(0,0%,100%,0))}.black{background:linear-gradient(0,#000,transparent)}.pointer{top:34.902%;left:18.6747%;cursor:pointer;position:absolute;outline:0}.handler{box-shadow:0 0 0 1.5px #fff,inset 0 0 1px 1px rgb(0,0,0,0.3),0 0 1px 2px rgb(0,0,0,0.4);-webkit-transform:translate(-2px,-2px);transform:translate(-2px,-2px);border-radius:100%;width:.25rem;height:.25rem;outline:0}";
    var p = "tc-hsv-changed",
        f = "tc-hue-changed",
        m = "tc-alpha-changed",
        D = "tc-button-clicked",
        nt = (o) => {
            !o ||
                document.dispatchEvent(
                    new CustomEvent(D, { detail: { cid: o } }),
                );
        },
        M = (o, e) => {
            !o ||
                document.dispatchEvent(
                    new CustomEvent(m, { detail: { a: e, cid: o } }),
                );
        },
        b = (o, e, t, i) => {
            !o ||
                document.dispatchEvent(
                    new CustomEvent(p, {
                        detail: { h: e, s: t, v: i, cid: o },
                    }),
                );
        },
        st = (o, e) => {
            !o ||
                document.dispatchEvent(
                    new CustomEvent(f, { detail: { h: e, cid: o } }),
                );
        };
    function u(o, e) {
        St(o) && (o = "100%");
        var t = Tt(o);
        return (
            (o = e === 360 ? o : Math.min(e, Math.max(0, parseFloat(o)))),
            t && (o = parseInt(String(o * e), 10) / 100),
            Math.abs(o - e) < 1e-6
                ? 1
                : (e === 360
                      ? (o =
                            (o < 0 ? (o % e) + e : o % e) /
                            parseFloat(String(e)))
                      : (o = (o % e) / parseFloat(String(e))),
                  o)
        );
    }
    function k(o) {
        return Math.min(1, Math.max(0, o));
    }
    function St(o) {
        return (
            typeof o == "string" && o.indexOf(".") !== -1 && parseFloat(o) === 1
        );
    }
    function Tt(o) {
        return typeof o == "string" && o.indexOf("%") !== -1;
    }
    function _(o) {
        return (o = parseFloat(o)), (isNaN(o) || o < 0 || o > 1) && (o = 1), o;
    }
    function L(o) {
        return o <= 1 ? "".concat(Number(o) * 100, "%") : o;
    }
    function C(o) {
        return o.length === 1 ? "0" + o : String(o);
    }
    function at(o, e, t) {
        return { r: u(o, 255) * 255, g: u(e, 255) * 255, b: u(t, 255) * 255 };
    }
    function U(o, e, t) {
        (o = u(o, 255)), (e = u(e, 255)), (t = u(t, 255));
        var i = Math.max(o, e, t),
            r = Math.min(o, e, t),
            n = 0,
            s = 0,
            a = (i + r) / 2;
        if (i === r) (s = 0), (n = 0);
        else {
            var d = i - r;
            switch (((s = a > 0.5 ? d / (2 - i - r) : d / (i + r)), i)) {
                case o:
                    n = (e - t) / d + (e < t ? 6 : 0);
                    break;
                case e:
                    n = (t - o) / d + 2;
                    break;
                case t:
                    n = (o - e) / d + 4;
                    break;
                default:
                    break;
            }
            n /= 6;
        }
        return { h: n, s, l: a };
    }
    function O(o, e, t) {
        return (
            t < 0 && (t += 1),
            t > 1 && (t -= 1),
            t < 1 / 6
                ? o + (e - o) * (6 * t)
                : t < 1 / 2
                ? e
                : t < 2 / 3
                ? o + (e - o) * (2 / 3 - t) * 6
                : o
        );
    }
    function ht(o, e, t) {
        var i, r, n;
        if (((o = u(o, 360)), (e = u(e, 100)), (t = u(t, 100)), e === 0))
            (r = t), (n = t), (i = t);
        else {
            var s = t < 0.5 ? t * (1 + e) : t + e - t * e,
                a = 2 * t - s;
            (i = O(a, s, o + 1 / 3)),
                (r = O(a, s, o)),
                (n = O(a, s, o - 1 / 3));
        }
        return { r: i * 255, g: r * 255, b: n * 255 };
    }
    function N(o, e, t) {
        (o = u(o, 255)), (e = u(e, 255)), (t = u(t, 255));
        var i = Math.max(o, e, t),
            r = Math.min(o, e, t),
            n = 0,
            s = i,
            a = i - r,
            d = i === 0 ? 0 : a / i;
        if (i === r) n = 0;
        else {
            switch (i) {
                case o:
                    n = (e - t) / a + (e < t ? 6 : 0);
                    break;
                case e:
                    n = (t - o) / a + 2;
                    break;
                case t:
                    n = (o - e) / a + 4;
                    break;
                default:
                    break;
            }
            n /= 6;
        }
        return { h: n, s: d, v: s };
    }
    function lt(o, e, t) {
        (o = u(o, 360) * 6), (e = u(e, 100)), (t = u(t, 100));
        var i = Math.floor(o),
            r = o - i,
            n = t * (1 - e),
            s = t * (1 - r * e),
            a = t * (1 - (1 - r) * e),
            d = i % 6,
            w = [t, s, n, n, a, t][d],
            x = [a, t, t, s, n, n][d],
            R = [n, n, a, t, t, s][d];
        return { r: w * 255, g: x * 255, b: R * 255 };
    }
    function K(o, e, t, i) {
        var r = [
            C(Math.round(o).toString(16)),
            C(Math.round(e).toString(16)),
            C(Math.round(t).toString(16)),
        ];
        return i &&
            r[0].startsWith(r[0].charAt(1)) &&
            r[1].startsWith(r[1].charAt(1)) &&
            r[2].startsWith(r[2].charAt(1))
            ? r[0].charAt(0) + r[1].charAt(0) + r[2].charAt(0)
            : r.join("");
    }
    function dt(o, e, t, i, r) {
        var n = [
            C(Math.round(o).toString(16)),
            C(Math.round(e).toString(16)),
            C(Math.round(t).toString(16)),
            C(Rt(i)),
        ];
        return r &&
            n[0].startsWith(n[0].charAt(1)) &&
            n[1].startsWith(n[1].charAt(1)) &&
            n[2].startsWith(n[2].charAt(1)) &&
            n[3].startsWith(n[3].charAt(1))
            ? n[0].charAt(0) + n[1].charAt(0) + n[2].charAt(0) + n[3].charAt(0)
            : n.join("");
    }
    function Rt(o) {
        return Math.round(parseFloat(o) * 255).toString(16);
    }
    function V(o) {
        return g(o) / 255;
    }
    function g(o) {
        return parseInt(o, 16);
    }
    function ut(o) {
        return { r: o >> 16, g: (o & 65280) >> 8, b: o & 255 };
    }
    var A = {
        aliceblue: "#f0f8ff",
        antiquewhite: "#faebd7",
        aqua: "#00ffff",
        aquamarine: "#7fffd4",
        azure: "#f0ffff",
        beige: "#f5f5dc",
        bisque: "#ffe4c4",
        black: "#000000",
        blanchedalmond: "#ffebcd",
        blue: "#0000ff",
        blueviolet: "#8a2be2",
        brown: "#a52a2a",
        burlywood: "#deb887",
        cadetblue: "#5f9ea0",
        chartreuse: "#7fff00",
        chocolate: "#d2691e",
        coral: "#ff7f50",
        cornflowerblue: "#6495ed",
        cornsilk: "#fff8dc",
        crimson: "#dc143c",
        cyan: "#00ffff",
        darkblue: "#00008b",
        darkcyan: "#008b8b",
        darkgoldenrod: "#b8860b",
        darkgray: "#a9a9a9",
        darkgreen: "#006400",
        darkgrey: "#a9a9a9",
        darkkhaki: "#bdb76b",
        darkmagenta: "#8b008b",
        darkolivegreen: "#556b2f",
        darkorange: "#ff8c00",
        darkorchid: "#9932cc",
        darkred: "#8b0000",
        darksalmon: "#e9967a",
        darkseagreen: "#8fbc8f",
        darkslateblue: "#483d8b",
        darkslategray: "#2f4f4f",
        darkslategrey: "#2f4f4f",
        darkturquoise: "#00ced1",
        darkviolet: "#9400d3",
        deeppink: "#ff1493",
        deepskyblue: "#00bfff",
        dimgray: "#696969",
        dimgrey: "#696969",
        dodgerblue: "#1e90ff",
        firebrick: "#b22222",
        floralwhite: "#fffaf0",
        forestgreen: "#228b22",
        fuchsia: "#ff00ff",
        gainsboro: "#dcdcdc",
        ghostwhite: "#f8f8ff",
        goldenrod: "#daa520",
        gold: "#ffd700",
        gray: "#808080",
        green: "#008000",
        greenyellow: "#adff2f",
        grey: "#808080",
        honeydew: "#f0fff0",
        hotpink: "#ff69b4",
        indianred: "#cd5c5c",
        indigo: "#4b0082",
        ivory: "#fffff0",
        khaki: "#f0e68c",
        lavenderblush: "#fff0f5",
        lavender: "#e6e6fa",
        lawngreen: "#7cfc00",
        lemonchiffon: "#fffacd",
        lightblue: "#add8e6",
        lightcoral: "#f08080",
        lightcyan: "#e0ffff",
        lightgoldenrodyellow: "#fafad2",
        lightgray: "#d3d3d3",
        lightgreen: "#90ee90",
        lightgrey: "#d3d3d3",
        lightpink: "#ffb6c1",
        lightsalmon: "#ffa07a",
        lightseagreen: "#20b2aa",
        lightskyblue: "#87cefa",
        lightslategray: "#778899",
        lightslategrey: "#778899",
        lightsteelblue: "#b0c4de",
        lightyellow: "#ffffe0",
        lime: "#00ff00",
        limegreen: "#32cd32",
        linen: "#faf0e6",
        magenta: "#ff00ff",
        maroon: "#800000",
        mediumaquamarine: "#66cdaa",
        mediumblue: "#0000cd",
        mediumorchid: "#ba55d3",
        mediumpurple: "#9370db",
        mediumseagreen: "#3cb371",
        mediumslateblue: "#7b68ee",
        mediumspringgreen: "#00fa9a",
        mediumturquoise: "#48d1cc",
        mediumvioletred: "#c71585",
        midnightblue: "#191970",
        mintcream: "#f5fffa",
        mistyrose: "#ffe4e1",
        moccasin: "#ffe4b5",
        navajowhite: "#ffdead",
        navy: "#000080",
        oldlace: "#fdf5e6",
        olive: "#808000",
        olivedrab: "#6b8e23",
        orange: "#ffa500",
        orangered: "#ff4500",
        orchid: "#da70d6",
        palegoldenrod: "#eee8aa",
        palegreen: "#98fb98",
        paleturquoise: "#afeeee",
        palevioletred: "#db7093",
        papayawhip: "#ffefd5",
        peachpuff: "#ffdab9",
        peru: "#cd853f",
        pink: "#ffc0cb",
        plum: "#dda0dd",
        powderblue: "#b0e0e6",
        purple: "#800080",
        rebeccapurple: "#663399",
        red: "#ff0000",
        rosybrown: "#bc8f8f",
        royalblue: "#4169e1",
        saddlebrown: "#8b4513",
        salmon: "#fa8072",
        sandybrown: "#f4a460",
        seagreen: "#2e8b57",
        seashell: "#fff5ee",
        sienna: "#a0522d",
        silver: "#c0c0c0",
        skyblue: "#87ceeb",
        slateblue: "#6a5acd",
        slategray: "#708090",
        slategrey: "#708090",
        snow: "#fffafa",
        springgreen: "#00ff7f",
        steelblue: "#4682b4",
        tan: "#d2b48c",
        teal: "#008080",
        thistle: "#d8bfd8",
        tomato: "#ff6347",
        turquoise: "#40e0d0",
        violet: "#ee82ee",
        wheat: "#f5deb3",
        white: "#ffffff",
        whitesmoke: "#f5f5f5",
        yellow: "#ffff00",
        yellowgreen: "#9acd32",
    };
    function ct(o) {
        var e = { r: 0, g: 0, b: 0 },
            t = 1,
            i = null,
            r = null,
            n = null,
            s = !1,
            a = !1;
        return (
            typeof o == "string" && (o = Pt(o)),
            typeof o == "object" &&
                (E(o.r) && E(o.g) && E(o.b)
                    ? ((e = at(o.r, o.g, o.b)),
                      (s = !0),
                      (a = String(o.r).substr(-1) === "%" ? "prgb" : "rgb"))
                    : E(o.h) && E(o.s) && E(o.v)
                    ? ((i = L(o.s)),
                      (r = L(o.v)),
                      (e = lt(o.h, i, r)),
                      (s = !0),
                      (a = "hsv"))
                    : E(o.h) &&
                      E(o.s) &&
                      E(o.l) &&
                      ((i = L(o.s)),
                      (n = L(o.l)),
                      (e = ht(o.h, i, n)),
                      (s = !0),
                      (a = "hsl")),
                Object.prototype.hasOwnProperty.call(o, "a") && (t = o.a)),
            (t = _(t)),
            {
                ok: s,
                format: o.format || a,
                r: Math.min(255, Math.max(e.r, 0)),
                g: Math.min(255, Math.max(e.g, 0)),
                b: Math.min(255, Math.max(e.b, 0)),
                a: t,
            }
        );
    }
    var Dt = "[-\\+]?\\d+%?",
        _t = "[-\\+]?\\d*\\.\\d+%?",
        y = "(?:".concat(_t, ")|(?:").concat(Dt, ")"),
        G = "[\\s|\\(]+("
            .concat(y, ")[,|\\s]+(")
            .concat(y, ")[,|\\s]+(")
            .concat(y, ")\\s*\\)?"),
        F = "[\\s|\\(]+("
            .concat(y, ")[,|\\s]+(")
            .concat(y, ")[,|\\s]+(")
            .concat(y, ")[,|\\s]+(")
            .concat(y, ")\\s*\\)?"),
        v = {
            CSS_UNIT: new RegExp(y),
            rgb: new RegExp("rgb" + G),
            rgba: new RegExp("rgba" + F),
            hsl: new RegExp("hsl" + G),
            hsla: new RegExp("hsla" + F),
            hsv: new RegExp("hsv" + G),
            hsva: new RegExp("hsva" + F),
            hex3: /^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
            hex6: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,
            hex4: /^#?([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})([0-9a-fA-F]{1})$/,
            hex8: /^#?([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})([0-9a-fA-F]{2})$/,
        };
    function Pt(o) {
        if (((o = o.trim().toLowerCase()), o.length === 0)) return !1;
        var e = !1;
        if (A[o]) (o = A[o]), (e = !0);
        else if (o === "transparent")
            return { r: 0, g: 0, b: 0, a: 0, format: "name" };
        var t = v.rgb.exec(o);
        return t
            ? { r: t[1], g: t[2], b: t[3] }
            : ((t = v.rgba.exec(o)),
              t
                  ? { r: t[1], g: t[2], b: t[3], a: t[4] }
                  : ((t = v.hsl.exec(o)),
                    t
                        ? { h: t[1], s: t[2], l: t[3] }
                        : ((t = v.hsla.exec(o)),
                          t
                              ? { h: t[1], s: t[2], l: t[3], a: t[4] }
                              : ((t = v.hsv.exec(o)),
                                t
                                    ? { h: t[1], s: t[2], v: t[3] }
                                    : ((t = v.hsva.exec(o)),
                                      t
                                          ? {
                                                h: t[1],
                                                s: t[2],
                                                v: t[3],
                                                a: t[4],
                                            }
                                          : ((t = v.hex8.exec(o)),
                                            t
                                                ? {
                                                      r: g(t[1]),
                                                      g: g(t[2]),
                                                      b: g(t[3]),
                                                      a: V(t[4]),
                                                      format: e
                                                          ? "name"
                                                          : "hex8",
                                                  }
                                                : ((t = v.hex6.exec(o)),
                                                  t
                                                      ? {
                                                            r: g(t[1]),
                                                            g: g(t[2]),
                                                            b: g(t[3]),
                                                            format: e
                                                                ? "name"
                                                                : "hex",
                                                        }
                                                      : ((t = v.hex4.exec(o)),
                                                        t
                                                            ? {
                                                                  r: g(
                                                                      t[1] +
                                                                          t[1],
                                                                  ),
                                                                  g: g(
                                                                      t[2] +
                                                                          t[2],
                                                                  ),
                                                                  b: g(
                                                                      t[3] +
                                                                          t[3],
                                                                  ),
                                                                  a: V(
                                                                      t[4] +
                                                                          t[4],
                                                                  ),
                                                                  format: e
                                                                      ? "name"
                                                                      : "hex8",
                                                              }
                                                            : ((t =
                                                                  v.hex3.exec(
                                                                      o,
                                                                  )),
                                                              t
                                                                  ? {
                                                                        r: g(
                                                                            t[1] +
                                                                                t[1],
                                                                        ),
                                                                        g: g(
                                                                            t[2] +
                                                                                t[2],
                                                                        ),
                                                                        b: g(
                                                                            t[3] +
                                                                                t[3],
                                                                        ),
                                                                        format: e
                                                                            ? "name"
                                                                            : "hex",
                                                                    }
                                                                  : !1)))))))));
    }
    function E(o) {
        return Boolean(v.CSS_UNIT.exec(String(o)));
    }
    var l = (function () {
        function o(e, t) {
            e === void 0 && (e = ""), t === void 0 && (t = {});
            var i;
            if (e instanceof o) return e;
            typeof e == "number" && (e = ut(e)), (this.originalInput = e);
            var r = ct(e);
            (this.originalInput = e),
                (this.r = r.r),
                (this.g = r.g),
                (this.b = r.b),
                (this.a = r.a),
                (this.roundA = Math.round(100 * this.a) / 100),
                (this.format =
                    (i = t.format) !== null && i !== void 0 ? i : r.format),
                (this.gradientType = t.gradientType),
                this.r < 1 && (this.r = Math.round(this.r)),
                this.g < 1 && (this.g = Math.round(this.g)),
                this.b < 1 && (this.b = Math.round(this.b)),
                (this.isValid = r.ok);
        }
        return (
            (o.prototype.isDark = function () {
                return this.getBrightness() < 128;
            }),
            (o.prototype.isLight = function () {
                return !this.isDark();
            }),
            (o.prototype.getBrightness = function () {
                var e = this.toRgb();
                return (e.r * 299 + e.g * 587 + e.b * 114) / 1e3;
            }),
            (o.prototype.getLuminance = function () {
                var e = this.toRgb(),
                    t,
                    i,
                    r,
                    n = e.r / 255,
                    s = e.g / 255,
                    a = e.b / 255;
                return (
                    n <= 0.03928
                        ? (t = n / 12.92)
                        : (t = Math.pow((n + 0.055) / 1.055, 2.4)),
                    s <= 0.03928
                        ? (i = s / 12.92)
                        : (i = Math.pow((s + 0.055) / 1.055, 2.4)),
                    a <= 0.03928
                        ? (r = a / 12.92)
                        : (r = Math.pow((a + 0.055) / 1.055, 2.4)),
                    0.2126 * t + 0.7152 * i + 0.0722 * r
                );
            }),
            (o.prototype.getAlpha = function () {
                return this.a;
            }),
            (o.prototype.setAlpha = function (e) {
                return (
                    (this.a = _(e)),
                    (this.roundA = Math.round(100 * this.a) / 100),
                    this
                );
            }),
            (o.prototype.toHsv = function () {
                var e = N(this.r, this.g, this.b);
                return { h: e.h * 360, s: e.s, v: e.v, a: this.a };
            }),
            (o.prototype.toHsvString = function () {
                var e = N(this.r, this.g, this.b),
                    t = Math.round(e.h * 360),
                    i = Math.round(e.s * 100),
                    r = Math.round(e.v * 100);
                return this.a === 1
                    ? "hsv(".concat(t, ", ").concat(i, "%, ").concat(r, "%)")
                    : "hsva("
                          .concat(t, ", ")
                          .concat(i, "%, ")
                          .concat(r, "%, ")
                          .concat(this.roundA, ")");
            }),
            (o.prototype.toHsl = function () {
                var e = U(this.r, this.g, this.b);
                return { h: e.h * 360, s: e.s, l: e.l, a: this.a };
            }),
            (o.prototype.toHslString = function () {
                var e = U(this.r, this.g, this.b),
                    t = Math.round(e.h * 360),
                    i = Math.round(e.s * 100),
                    r = Math.round(e.l * 100);
                return this.a === 1
                    ? "hsl(".concat(t, ", ").concat(i, "%, ").concat(r, "%)")
                    : "hsla("
                          .concat(t, ", ")
                          .concat(i, "%, ")
                          .concat(r, "%, ")
                          .concat(this.roundA, ")");
            }),
            (o.prototype.toHex = function (e) {
                return e === void 0 && (e = !1), K(this.r, this.g, this.b, e);
            }),
            (o.prototype.toHexString = function (e) {
                return e === void 0 && (e = !1), "#" + this.toHex(e);
            }),
            (o.prototype.toHex8 = function (e) {
                return (
                    e === void 0 && (e = !1),
                    dt(this.r, this.g, this.b, this.a, e)
                );
            }),
            (o.prototype.toHex8String = function (e) {
                return e === void 0 && (e = !1), "#" + this.toHex8(e);
            }),
            (o.prototype.toRgb = function () {
                return {
                    r: Math.round(this.r),
                    g: Math.round(this.g),
                    b: Math.round(this.b),
                    a: this.a,
                };
            }),
            (o.prototype.toRgbString = function () {
                var e = Math.round(this.r),
                    t = Math.round(this.g),
                    i = Math.round(this.b);
                return this.a === 1
                    ? "rgb(".concat(e, ", ").concat(t, ", ").concat(i, ")")
                    : "rgba("
                          .concat(e, ", ")
                          .concat(t, ", ")
                          .concat(i, ", ")
                          .concat(this.roundA, ")");
            }),
            (o.prototype.toPercentageRgb = function () {
                var e = function (t) {
                    return "".concat(Math.round(u(t, 255) * 100), "%");
                };
                return { r: e(this.r), g: e(this.g), b: e(this.b), a: this.a };
            }),
            (o.prototype.toPercentageRgbString = function () {
                var e = function (t) {
                    return Math.round(u(t, 255) * 100);
                };
                return this.a === 1
                    ? "rgb("
                          .concat(e(this.r), "%, ")
                          .concat(e(this.g), "%, ")
                          .concat(e(this.b), "%)")
                    : "rgba("
                          .concat(e(this.r), "%, ")
                          .concat(e(this.g), "%, ")
                          .concat(e(this.b), "%, ")
                          .concat(this.roundA, ")");
            }),
            (o.prototype.toName = function () {
                if (this.a === 0) return "transparent";
                if (this.a < 1) return !1;
                for (
                    var e = "#" + K(this.r, this.g, this.b, !1),
                        t = 0,
                        i = Object.entries(A);
                    t < i.length;
                    t++
                ) {
                    var r = i[t],
                        n = r[0],
                        s = r[1];
                    if (e === s) return n;
                }
                return !1;
            }),
            (o.prototype.toString = function (e) {
                var t = Boolean(e);
                e = e != null ? e : this.format;
                var i = !1,
                    r = this.a < 1 && this.a >= 0,
                    n = !t && r && (e.startsWith("hex") || e === "name");
                return n
                    ? e === "name" && this.a === 0
                        ? this.toName()
                        : this.toRgbString()
                    : (e === "rgb" && (i = this.toRgbString()),
                      e === "prgb" && (i = this.toPercentageRgbString()),
                      (e === "hex" || e === "hex6") && (i = this.toHexString()),
                      e === "hex3" && (i = this.toHexString(!0)),
                      e === "hex4" && (i = this.toHex8String(!0)),
                      e === "hex8" && (i = this.toHex8String()),
                      e === "name" && (i = this.toName()),
                      e === "hsl" && (i = this.toHslString()),
                      e === "hsv" && (i = this.toHsvString()),
                      i || this.toHexString());
            }),
            (o.prototype.toNumber = function () {
                return (
                    (Math.round(this.r) << 16) +
                    (Math.round(this.g) << 8) +
                    Math.round(this.b)
                );
            }),
            (o.prototype.clone = function () {
                return new o(this.toString());
            }),
            (o.prototype.lighten = function (e) {
                e === void 0 && (e = 10);
                var t = this.toHsl();
                return (t.l += e / 100), (t.l = k(t.l)), new o(t);
            }),
            (o.prototype.brighten = function (e) {
                e === void 0 && (e = 10);
                var t = this.toRgb();
                return (
                    (t.r = Math.max(
                        0,
                        Math.min(255, t.r - Math.round(255 * -(e / 100))),
                    )),
                    (t.g = Math.max(
                        0,
                        Math.min(255, t.g - Math.round(255 * -(e / 100))),
                    )),
                    (t.b = Math.max(
                        0,
                        Math.min(255, t.b - Math.round(255 * -(e / 100))),
                    )),
                    new o(t)
                );
            }),
            (o.prototype.darken = function (e) {
                e === void 0 && (e = 10);
                var t = this.toHsl();
                return (t.l -= e / 100), (t.l = k(t.l)), new o(t);
            }),
            (o.prototype.tint = function (e) {
                return e === void 0 && (e = 10), this.mix("white", e);
            }),
            (o.prototype.shade = function (e) {
                return e === void 0 && (e = 10), this.mix("black", e);
            }),
            (o.prototype.desaturate = function (e) {
                e === void 0 && (e = 10);
                var t = this.toHsl();
                return (t.s -= e / 100), (t.s = k(t.s)), new o(t);
            }),
            (o.prototype.saturate = function (e) {
                e === void 0 && (e = 10);
                var t = this.toHsl();
                return (t.s += e / 100), (t.s = k(t.s)), new o(t);
            }),
            (o.prototype.greyscale = function () {
                return this.desaturate(100);
            }),
            (o.prototype.spin = function (e) {
                var t = this.toHsl(),
                    i = (t.h + e) % 360;
                return (t.h = i < 0 ? 360 + i : i), new o(t);
            }),
            (o.prototype.mix = function (e, t) {
                t === void 0 && (t = 50);
                var i = this.toRgb(),
                    r = new o(e).toRgb(),
                    n = t / 100,
                    s = {
                        r: (r.r - i.r) * n + i.r,
                        g: (r.g - i.g) * n + i.g,
                        b: (r.b - i.b) * n + i.b,
                        a: (r.a - i.a) * n + i.a,
                    };
                return new o(s);
            }),
            (o.prototype.analogous = function (e, t) {
                e === void 0 && (e = 6), t === void 0 && (t = 30);
                var i = this.toHsl(),
                    r = 360 / t,
                    n = [this];
                for (i.h = (i.h - ((r * e) >> 1) + 720) % 360; --e; )
                    (i.h = (i.h + r) % 360), n.push(new o(i));
                return n;
            }),
            (o.prototype.complement = function () {
                var e = this.toHsl();
                return (e.h = (e.h + 180) % 360), new o(e);
            }),
            (o.prototype.monochromatic = function (e) {
                e === void 0 && (e = 6);
                for (
                    var t = this.toHsv(),
                        i = t.h,
                        r = t.s,
                        n = t.v,
                        s = [],
                        a = 1 / e;
                    e--;

                )
                    s.push(new o({ h: i, s: r, v: n })), (n = (n + a) % 1);
                return s;
            }),
            (o.prototype.splitcomplement = function () {
                var e = this.toHsl(),
                    t = e.h;
                return [
                    this,
                    new o({ h: (t + 72) % 360, s: e.s, l: e.l }),
                    new o({ h: (t + 216) % 360, s: e.s, l: e.l }),
                ];
            }),
            (o.prototype.onBackground = function (e) {
                var t = this.toRgb(),
                    i = new o(e).toRgb();
                return new o({
                    r: i.r + (t.r - i.r) * t.a,
                    g: i.g + (t.g - i.g) * t.a,
                    b: i.b + (t.b - i.b) * t.a,
                });
            }),
            (o.prototype.triad = function () {
                return this.polyad(3);
            }),
            (o.prototype.tetrad = function () {
                return this.polyad(4);
            }),
            (o.prototype.polyad = function (e) {
                for (
                    var t = this.toHsl(),
                        i = t.h,
                        r = [this],
                        n = 360 / e,
                        s = 1;
                    s < e;
                    s++
                )
                    r.push(new o({ h: (i + s * n) % 360, s: t.s, l: t.l }));
                return r;
            }),
            (o.prototype.equals = function (e) {
                return this.toRgbString() === new o(e).toRgbString();
            }),
            o
        );
    })();
    var $ = () => Math.random().toString(16).slice(2),
        P = (o) => Math.round((o + Number.EPSILON) * 100) / 100;
    var H = 0.01,
        q = (o) => (
            o < 0 && (o = 0),
            o > 360 && (o = 360),
            `hsl(${Math.round(o)}, 100%, 50%)`
        ),
        z = (o) => {
            let e = o.toRgb();
            return `linear-gradient(to right, rgba(${e.r},${e.g},${e.b}, 0) 0%, rgba(${e.r},${e.g},${e.b}, 1) 100%)`;
        },
        S = (o) => {
            let e = o.toRgb();
            return `rgba(${e.r}, ${e.g}, ${e.b}, ${P(e.a)})`;
        },
        pt = (o) => {
            let e = o.toHsl();
            return `hsla(${Math.round(e.h)}, ${Math.round(
                e.s * 100,
            )}%, ${Math.round(e.l * 100)}%, ${P(e.a)})`;
        },
        gt = (o) => {
            let e = o.toHsv();
            return `hsva(${Math.round(e.h)}, ${Math.round(
                e.s * 100,
            )}%, ${Math.round(e.v * 100)}%, ${P(e.a)})`;
        },
        W = (o) => (
            o < 0 && (o = 0),
            o > 1 && (o = 1),
            `${(-(o * 100) + 100).toFixed(2)}%`
        ),
        X = (o) => (
            o < 0 && (o = 0), o > 1 && (o = 1), `${(o * 100).toFixed(2)}%`
        ),
        T = (o) => {
            o < 0 && (o = 0), o > 360 && (o = 360);
            let e = (o * 100) / 360,
                t = Math.round(e * 100) / 100;
            return t < 0 && (t = 0), t > 100 && (t = 100), t;
        },
        B = (o) => (360 * o) / 100,
        I = (o) => {
            let e = Number(o) || 0;
            return (
                (e = Math.round(e)),
                (e = Math.max(0, e)),
                (e = Math.min(255, e)),
                e
            );
        },
        ft = (o) => {
            let e = Number(o) || 100;
            return (
                (e = Math.round(e)),
                (e = Math.max(0, e)),
                (e = Math.min(100, e)),
                e
            );
        },
        c = (o) => {
            let e = new l(o || "#000");
            return e.setAlpha(e.getAlpha()), e;
        };
    var j = class extends HTMLElement {
            constructor() {
                super();
                h(this, "cid");
                h(this, "$saturation");
                h(this, "$color");
                h(this, "$pointer");
                h(this, "hue", 0);
                h(this, "saturation", 0);
                h(this, "value", 0);
                this.attachShadow({ mode: "open" }),
                    (this.onMouseDown = this.onMouseDown.bind(this)),
                    (this.onMouseUp = this.onMouseUp.bind(this)),
                    (this.onChange = this.onChange.bind(this)),
                    (this.onPointerKeyDown = this.onPointerKeyDown.bind(this)),
                    (this.hsvChanged = this.hsvChanged.bind(this)),
                    (this.hueChanged = this.hueChanged.bind(this));
            }
            static get observedAttributes() {
                return ["color"];
            }
            render(t = !0) {
                this.$pointer &&
                    ((this.$pointer.style.left = X(this.saturation)),
                    (this.$pointer.style.top = W(this.value))),
                    this.$color &&
                        this.$color.setAttribute(
                            "style",
                            `background: ${q(this.hue)}`,
                        ),
                    t && b(this.cid, this.hue, this.saturation, this.value);
            }
            onChange(t) {
                if (!this.$saturation) return;
                let {
                    width: i,
                    height: r,
                    left: n,
                    top: s,
                } = this.$saturation.getBoundingClientRect();
                if (i === 0 || r === 0) return;
                let a =
                        typeof t.clientX == "number"
                            ? t.clientX
                            : t.touches[0].clientX,
                    d =
                        typeof t.clientY == "number"
                            ? t.clientY
                            : t.touches[0].clientY,
                    w = Math.min(Math.max(0, a - n), i),
                    x = Math.min(Math.max(0, d - s), r);
                (this.saturation = w / i),
                    (this.value = 1 - x / r),
                    this.render();
            }
            onPointerKeyDown(t) {
                switch (t.key) {
                    case "ArrowLeft": {
                        (this.saturation = Math.max(0, this.saturation - H)),
                            this.render();
                        break;
                    }
                    case "ArrowRight": {
                        (this.saturation = Math.min(1, this.saturation + H)),
                            this.render();
                        break;
                    }
                    case "ArrowUp": {
                        (this.value = Math.min(1, this.value + H)),
                            this.render();
                        break;
                    }
                    case "ArrowDown": {
                        t.preventDefault(),
                            (this.value = Math.max(0, this.value - H)),
                            this.render();
                        break;
                    }
                }
            }
            onMouseDown(t) {
                t.preventDefault && t.preventDefault(),
                    this.onChange(t),
                    window.addEventListener("mousemove", this.onChange),
                    window.addEventListener("mouseup", this.onMouseUp),
                    window.setTimeout(() => {
                        var i;
                        (i = this.$pointer) == null || i.focus();
                    }, 0);
            }
            onMouseUp() {
                window.removeEventListener("mousemove", this.onChange),
                    window.removeEventListener("mouseup", this.onChange);
            }
            hsvChanged(t) {
                if (
                    !t ||
                    !t.detail ||
                    !t.detail.cid ||
                    t.detail.cid !== this.cid
                )
                    return;
                let i = !1;
                this.hue !== t.detail.h && ((this.hue = t.detail.h), (i = !0)),
                    this.saturation !== t.detail.s &&
                        ((this.saturation = t.detail.s), (i = !0)),
                    this.value !== t.detail.v &&
                        ((this.value = t.detail.v), (i = !0)),
                    i && this.render(!1);
            }
            hueChanged(t) {
                !t ||
                    !t.detail ||
                    !t.detail.cid ||
                    (t.detail.cid === this.cid &&
                        ((this.hue = t.detail.h), this.render()));
            }
            connectedCallback() {
                var s, a, d, w, x;
                if (!this.shadowRoot) return;
                this.cid = this.getAttribute("cid") || "";
                let i = c(this.getAttribute("color")).toHsv();
                (this.hue = i.h), (this.saturation = i.s), (this.value = i.v);
                let r = W(this.value),
                    n = X(this.saturation);
                (this.shadowRoot.innerHTML = `
           <style>${rt}</style>
           <div class="saturation">
                <div class="box" style="background: ${q(this.hue)}">
                    <div class="white box">
                        <div class="black box"></div>
                        
                        <div class="pointer" tabindex="0" style="top: ${r}; left: ${n};">
                            <div class="handler"></div>
                        </div>
                    </div>
                </div>
           </div>
        `),
                    (this.$saturation =
                        this.shadowRoot.querySelector(".saturation")),
                    (this.$color = this.shadowRoot.querySelector(".box")),
                    (this.$pointer = this.shadowRoot.querySelector(".pointer")),
                    (s = this.$pointer) == null ||
                        s.addEventListener("keydown", this.onPointerKeyDown),
                    (a = this.$saturation) == null ||
                        a.addEventListener("mousedown", this.onMouseDown),
                    (d = this.$saturation) == null ||
                        d.addEventListener("mouseup", this.onMouseUp),
                    (w = this.$saturation) == null ||
                        w.addEventListener("touchmove", this.onChange),
                    (x = this.$saturation) == null ||
                        x.addEventListener("touchstart", this.onChange),
                    document.addEventListener(p, this.hsvChanged),
                    document.addEventListener(f, this.hueChanged);
            }
            disconnectedCallback() {
                var t, i, r, n, s;
                (t = this.$saturation) == null ||
                    t.removeEventListener("mousedown", this.onMouseDown),
                    (i = this.$saturation) == null ||
                        i.removeEventListener("mouseup", this.onMouseUp),
                    (r = this.$saturation) == null ||
                        r.removeEventListener("touchmove", this.onChange),
                    (n = this.$saturation) == null ||
                        n.removeEventListener("touchstart", this.onChange),
                    (s = this.$pointer) == null ||
                        s.removeEventListener("keydown", this.onPointerKeyDown),
                    document.removeEventListener(p, this.hsvChanged),
                    document.removeEventListener(f, this.hueChanged);
            }
            attributeChangedCallback(t, i, r) {
                let s = c(r).toHsv();
                (this.hue = s.h),
                    (this.saturation = s.s),
                    (this.value = s.v),
                    this.render(!1);
            }
        },
        bt = j;
    var vt =
        ".hue{overflow:hidden;height:.625rem;margin-bottom:.25rem;margin-top:.25rem;position:relative}.box{width:100%;height:100%;position:absolute}.hue-v{background:linear-gradient(0,red 0,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,red)}.hue-h{background:linear-gradient(90deg,red 0,#ff0 17%,#0f0 33%,#0ff 50%,#00f 67%,#f0f 83%,red);width:100%;height:100%;position:relative}.pointer-box{left:87%;position:absolute;outline:0}.handler{background:#fff;box-shadow:0 0 2px rgb(0 0 0 / 60%);box-sizing:border-box;border:1px solid hsla(0,0%,88%,.5);height:8px;margin-top:1px;-webkit-transform:translateX(-4px);transform:translateX(-4px);width:8px;cursor:pointer;outline:0}.pointer-box:focus .handler{border:2px solid hsla(0,0%,88%,1)}";
    var Y = class extends HTMLElement {
            constructor() {
                super();
                h(this, "cid");
                h(this, "$hue");
                h(this, "$pointer");
                h(this, "hue", 0);
                this.attachShadow({ mode: "open" }),
                    (this.onMouseDown = this.onMouseDown.bind(this)),
                    (this.onMouseUp = this.onMouseUp.bind(this)),
                    (this.onChange = this.onChange.bind(this)),
                    (this.onKeyDown = this.onKeyDown.bind(this)),
                    (this.hsvChanged = this.hsvChanged.bind(this));
            }
            static get observedAttributes() {
                return ["color"];
            }
            render() {
                this.$pointer && (this.$pointer.style.left = `${T(this.hue)}%`),
                    st(this.cid, this.hue);
            }
            hsvChanged(t) {
                !t ||
                    !t.detail ||
                    !t.detail.cid ||
                    (t.detail.cid === this.cid &&
                        this.hue !== t.detail.h &&
                        ((this.hue = t.detail.h), this.render()));
            }
            onChange(t) {
                if (!this.$hue) return;
                t.preventDefault && t.preventDefault();
                let { width: i, left: r } = this.$hue.getBoundingClientRect();
                if (i === 0) return;
                let n =
                        typeof t.clientX == "number"
                            ? t.clientX
                            : t.touches[0].clientX,
                    s = Math.min(Math.max(0, n - r), i),
                    a = Math.min(Math.max(0, Math.round((s * 100) / i)), 100);
                (this.hue = B(a)), this.render();
            }
            onKeyDown(t) {
                var i;
                switch (((i = this.$pointer) == null || i.focus(), t.key)) {
                    case "ArrowLeft": {
                        let r = T(this.hue);
                        (r = Math.max(0, r - 1)),
                            (this.hue = B(r)),
                            this.render();
                        break;
                    }
                    case "ArrowRight": {
                        let r = T(this.hue);
                        (r = Math.min(100, r + 1)),
                            (this.hue = B(r)),
                            this.render();
                        break;
                    }
                }
            }
            onMouseDown(t) {
                t.preventDefault && t.preventDefault(),
                    this.onChange(t),
                    window.addEventListener("mousemove", this.onChange),
                    window.addEventListener("mouseup", this.onMouseUp),
                    window.setTimeout(() => {
                        var i;
                        (i = this.$pointer) == null || i.focus();
                    }, 0);
            }
            onMouseUp() {
                window.removeEventListener("mousemove", this.onChange),
                    window.removeEventListener("mouseup", this.onChange);
            }
            connectedCallback() {
                var i, r, n, s, a;
                if (!this.shadowRoot) return;
                this.cid = this.getAttribute("cid") || "";
                let t = c(this.getAttribute("color"));
                (this.hue = t.toHsv().h),
                    (this.shadowRoot.innerHTML = `
           <style>${vt}</style>
           <div class="hue">
                <div class="box">
                    <div class="hue-v box">
                        <div class="hue-h"></div>
                    </div>
                    
                    <div class="pointer box">
                        <div class="pointer-box" tabindex="0" style="left: ${T(
                            this.hue,
                        )}%">
                            <div class="handler"></div>
                        </div>
                    </div>
                </div>
           </div>
        `),
                    (this.$hue = this.shadowRoot.querySelector(".hue")),
                    (this.$pointer =
                        this.shadowRoot.querySelector(".pointer-box")),
                    (i = this.$hue) == null ||
                        i.addEventListener("mousedown", this.onMouseDown),
                    (r = this.$hue) == null ||
                        r.addEventListener("mouseup", this.onMouseUp),
                    (n = this.$hue) == null ||
                        n.addEventListener("touchmove", this.onChange),
                    (s = this.$hue) == null ||
                        s.addEventListener("touchstart", this.onChange),
                    (a = this.$pointer) == null ||
                        a.addEventListener("keydown", this.onKeyDown),
                    document.addEventListener(p, this.hsvChanged);
            }
            disconnectedCallback() {
                var t, i, r, n, s;
                (t = this.$hue) == null ||
                    t.removeEventListener("mousedown", this.onMouseDown),
                    (i = this.$hue) == null ||
                        i.removeEventListener("mouseup", this.onMouseUp),
                    (r = this.$hue) == null ||
                        r.removeEventListener("touchmove", this.onChange),
                    (n = this.$hue) == null ||
                        n.removeEventListener("touchstart", this.onChange),
                    (s = this.$pointer) == null ||
                        s.removeEventListener("keydown", this.onKeyDown),
                    document.removeEventListener(p, this.hsvChanged);
            }
            attributeChangedCallback(t, i, r) {
                let s = c(r).toHsv();
                (this.hue = s.h), this.render();
            }
        },
        mt = Y;
    var wt =
        ".alpha{overflow:hidden;height:.625rem;position:relative;background:#fff}.box{width:100%;height:100%;position:absolute}.transparent-bg{background:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAADFJREFUOE9jZGBgEGHAD97gk2YcNYBhmIQBgWSAP52AwoAQwJvQRg1gACckQoC2gQgAIF8IscwEtKYAAAAASUVORK5CYII=);overflow:hidden}.pointer-box{left:100%;position:absolute;outline:0}.handler{background:#fff;box-shadow:0 0 2px rgb(0 0 0 / 60%);box-sizing:border-box;border:1px solid hsla(0,0%,88%,.5);height:8px;margin-top:1px;-webkit-transform:translateX(-4px);transform:translateX(-4px);width:8px;cursor:pointer;outline:0}.alpha-pointer-box:focus .alpha-pointer-handler{border:2px solid hsla(0,0%,88%,1)}";
    var Q = class extends HTMLElement {
            constructor() {
                super();
                h(this, "cid");
                h(this, "$alpha");
                h(this, "$color");
                h(this, "$pointer");
                h(this, "alpha", 1);
                h(this, "hue", 0);
                h(this, "saturation", 0);
                h(this, "value", 0);
                this.attachShadow({ mode: "open" }),
                    (this.onMouseDown = this.onMouseDown.bind(this)),
                    (this.onMouseUp = this.onMouseUp.bind(this)),
                    (this.onChange = this.onChange.bind(this)),
                    (this.onKeyDown = this.onKeyDown.bind(this)),
                    (this.hsvChanged = this.hsvChanged.bind(this)),
                    (this.hueChanged = this.hueChanged.bind(this)),
                    (this.alphaChanged = this.alphaChanged.bind(this));
            }
            static get observedAttributes() {
                return ["color"];
            }
            render(t = !0) {
                if (
                    (this.$pointer &&
                        (this.$pointer.style.left = `${this.alpha * 100}%`),
                    this.$color)
                ) {
                    let i = new l({
                        h: this.hue,
                        s: this.saturation,
                        v: this.value,
                        a: this.alpha,
                    });
                    this.$color.style.background = z(i);
                }
                t && M(this.cid, this.alpha);
            }
            onChange(t) {
                if (!this.$alpha) return;
                t.preventDefault && t.preventDefault();
                let { width: i, left: r } = this.$alpha.getBoundingClientRect();
                if (i === 0) return;
                let n =
                        typeof t.clientX == "number"
                            ? t.clientX
                            : t.touches[0].clientX,
                    s = Math.min(Math.max(0, n - r), i),
                    a = Math.min(Math.max(0, (s * 100) / i), 100);
                (this.alpha = a / 100), this.render();
            }
            onKeyDown(t) {
                var i;
                switch (((i = this.$pointer) == null || i.focus(), t.key)) {
                    case "ArrowLeft": {
                        let r = this.alpha * 100;
                        (r = Math.max(0, r - 1)),
                            (this.alpha = r / 100),
                            this.render();
                        break;
                    }
                    case "ArrowRight": {
                        let r = this.alpha * 100;
                        (r = Math.min(100, r + 1)),
                            (this.alpha = r / 100),
                            this.render();
                        break;
                    }
                }
            }
            hsvChanged(t) {
                !t ||
                    !t.detail ||
                    !t.detail.cid ||
                    (t.detail.cid === this.cid &&
                        ((this.saturation = t.detail.h),
                        (this.hue = t.detail.s),
                        (this.value = t.detail.v),
                        this.render(!1)));
            }
            hueChanged(t) {
                !t ||
                    !t.detail ||
                    !t.detail.cid ||
                    (t.detail.cid === this.cid &&
                        ((this.hue = t.detail.h), this.render(!1)));
            }
            alphaChanged(t) {
                !t ||
                    !t.detail ||
                    !t.detail.cid ||
                    (t.detail.cid === this.cid &&
                        this.alpha !== t.detail.a &&
                        ((this.alpha = t.detail.a), this.render()));
            }
            onMouseDown(t) {
                t.preventDefault && t.preventDefault(),
                    this.onChange(t),
                    window.addEventListener("mousemove", this.onChange),
                    window.addEventListener("mouseup", this.onMouseUp),
                    window.setTimeout(() => {
                        var i;
                        (i = this.$pointer) == null || i.focus();
                    }, 0);
            }
            onMouseUp() {
                window.removeEventListener("mousemove", this.onChange),
                    window.removeEventListener("mouseup", this.onChange);
            }
            connectedCallback() {
                var r, n, s, a, d;
                if (!this.shadowRoot) return;
                this.cid = this.getAttribute("cid") || "";
                let t = c(this.getAttribute("color")),
                    i = t.toHsv();
                (this.alpha = i.a),
                    (this.hue = i.h),
                    (this.saturation = i.s),
                    (this.value = i.v),
                    (this.shadowRoot.innerHTML = `
           <style>${wt}</style>
           <div class="alpha">
                <div class="box">
                    <div class="transparent-bg box"></div>
                    <div class="color-bg box" style="background: ${z(t)}"></div>
                    
                    <div class="pointer box">
                        <div class="pointer-box" tabindex="0" style="left: ${
                            this.alpha * 100
                        }%;" >
                            <div class="handler"></div>
                        </div>
                    </div>
                </div>
           </div>
        `),
                    (this.$alpha = this.shadowRoot.querySelector(".alpha")),
                    (this.$color = this.shadowRoot.querySelector(".color-bg")),
                    (this.$pointer =
                        this.shadowRoot.querySelector(".pointer-box")),
                    (r = this.$alpha) == null ||
                        r.addEventListener("mousedown", this.onMouseDown),
                    (n = this.$alpha) == null ||
                        n.addEventListener("mouseup", this.onMouseUp),
                    (s = this.$alpha) == null ||
                        s.addEventListener("touchmove", this.onChange),
                    (a = this.$alpha) == null ||
                        a.addEventListener("touchstart", this.onChange),
                    (d = this.$pointer) == null ||
                        d.addEventListener("keydown", this.onKeyDown),
                    document.addEventListener(p, this.hsvChanged),
                    document.addEventListener(f, this.hueChanged),
                    document.addEventListener(m, this.alphaChanged);
            }
            disconnectedCallback() {
                var t, i, r, n, s;
                (t = this.$alpha) == null ||
                    t.removeEventListener("mousedown", this.onMouseDown),
                    (i = this.$alpha) == null ||
                        i.removeEventListener("mouseup", this.onMouseUp),
                    (r = this.$alpha) == null ||
                        r.removeEventListener("touchmove", this.onChange),
                    (n = this.$alpha) == null ||
                        n.removeEventListener("touchstart", this.onChange),
                    (s = this.$pointer) == null ||
                        s.removeEventListener("keydown", this.onKeyDown),
                    document.removeEventListener(p, this.hsvChanged),
                    document.removeEventListener(f, this.hueChanged),
                    document.removeEventListener(m, this.alphaChanged);
            }
            attributeChangedCallback(t, i, r) {
                let s = c(r).toHsv();
                (this.alpha = s.a),
                    (this.hue = s.h),
                    (this.saturation = s.s),
                    (this.value = s.v),
                    this.render();
            }
        },
        xt = Q;
    var Et =
        ":root{--tool-cool-color-picker-field-border-color:#cecece;--tool-cool-color-picker-field-label-color:#000}.fields{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica Neue,Noto Sans,Liberation Sans,Arial,sans-serif,Apple Color Emoji,Segoe UI Emoji,Segoe UI Symbol,Noto Color Emoji;font-size:11px;grid-template-columns:60px 35px 35px 35px 34px;text-align:center;display:grid;gap:.25rem;margin-top:.25rem;color:var(--tool-cool-color-picker-field-label-color,#000)}.fields input{background:#fff;border-width:1px;border-style:solid;border-color:var(--tool-cool-color-picker-field-border-color,#cecece);padding:1px 3px;border-radius:2px;color:#000;font-family:inherit;font-size:100%;line-height:inherit;margin:0;box-sizing:border-box}";
    var J = class extends HTMLElement {
            constructor() {
                super();
                h(this, "cid");
                h(this, "color", new l("#000"));
                h(this, "$hex");
                h(this, "$r");
                h(this, "$g");
                h(this, "$b");
                h(this, "$a");
                h(this, "hex", "");
                h(this, "r", 0);
                h(this, "g", 0);
                h(this, "b", 0);
                h(this, "a", 1);
                this.attachShadow({ mode: "open" }),
                    (this.hsvChanged = this.hsvChanged.bind(this)),
                    (this.hueChanged = this.hueChanged.bind(this)),
                    (this.alphaChanged = this.alphaChanged.bind(this)),
                    (this.onHexChange = this.onHexChange.bind(this)),
                    (this.render = this.render.bind(this)),
                    (this.onRedChange = this.onRedChange.bind(this)),
                    (this.onGreenChange = this.onGreenChange.bind(this)),
                    (this.onBlueChange = this.onBlueChange.bind(this)),
                    (this.onAlphaChange = this.onAlphaChange.bind(this)),
                    (this.onRedKeyDown = this.onRedKeyDown.bind(this)),
                    (this.onBlueKeyDown = this.onBlueKeyDown.bind(this)),
                    (this.onGreenKeyDown = this.onGreenKeyDown.bind(this)),
                    (this.onAlphaKeyDown = this.onAlphaKeyDown.bind(this));
            }
            static get observedAttributes() {
                return ["color"];
            }
            hueChanged(t) {
                if (
                    !t ||
                    !t.detail ||
                    !t.detail.cid ||
                    t.detail.cid !== this.cid
                )
                    return;
                let i = this.color.toHsv();
                (this.color = new l({
                    h: Number(t.detail.h),
                    s: i.s,
                    v: i.v,
                    a: i.a,
                })),
                    this.render();
            }
            alphaChanged(t) {
                if (
                    !t ||
                    !t.detail ||
                    !t.detail.cid ||
                    t.detail.cid !== this.cid
                )
                    return;
                let i = this.color.toRgb();
                (i.a = t.detail.a), (this.color = new l(i)), this.render();
            }
            hsvChanged(t) {
                !t ||
                    !t.detail ||
                    !t.detail.cid ||
                    (t.detail.cid === this.cid &&
                        ((this.color = new l({
                            h: t.detail.h,
                            s: t.detail.s,
                            v: t.detail.v,
                            a: this.color.toHsv().a,
                        })),
                        this.render()));
            }
            render() {
                var i, r, n, s, a;
                let t = this.color.toRgb();
                (this.r = t.r),
                    (this.g = t.g),
                    (this.b = t.b),
                    (this.a = t.a),
                    (this.hex = this.color.toHex()),
                    this.$hex &&
                        ((i = this.shadowRoot) == null
                            ? void 0
                            : i.activeElement) !== this.$hex &&
                        (this.$hex.value = this.hex.toUpperCase()),
                    this.$r &&
                        ((r = this.shadowRoot) == null
                            ? void 0
                            : r.activeElement) !== this.$r &&
                        (this.$r.value = this.r.toString()),
                    this.$g &&
                        ((n = this.shadowRoot) == null
                            ? void 0
                            : n.activeElement) !== this.$g &&
                        (this.$g.value = this.g.toString()),
                    this.$b &&
                        ((s = this.shadowRoot) == null
                            ? void 0
                            : s.activeElement) !== this.$b &&
                        (this.$b.value = this.b.toString()),
                    this.$a &&
                        ((a = this.shadowRoot) == null
                            ? void 0
                            : a.activeElement) !== this.$a &&
                        (this.$a.value = Math.round(this.a * 100).toString());
            }
            onFieldKeyDown(t, i) {
                var n, s;
                let r = this.color.toRgb();
                switch (t.key) {
                    case "ArrowUp": {
                        if (i === "r") {
                            (this.r = Math.min(255, r.r + 1)), (r.r = this.r);
                            let a = new l(r).toHsv();
                            b(this.cid, a.h, a.s, a.v),
                                (this.$r.value = this.r.toString()),
                                this.render();
                        }
                        if (i === "g") {
                            (this.g = Math.min(255, r.g + 1)), (r.g = this.g);
                            let a = new l(r).toHsv();
                            b(this.cid, a.h, a.s, a.v),
                                (this.$g.value = this.g.toString()),
                                this.render();
                        }
                        if (i === "b") {
                            (this.b = Math.min(255, r.b + 1)), (r.b = this.b);
                            let a = new l(r).toHsv();
                            b(this.cid, a.h, a.s, a.v),
                                (this.$b.value = this.b.toString()),
                                this.render();
                        }
                        if (i === "a") {
                            (this.a = Math.min(100, this.a + 0.01)),
                                (this.$a.value = Math.round(
                                    this.a * 100,
                                ).toString());
                            let a = this.color.toRgb();
                            (a.a = this.a),
                                (this.color = new l(a)),
                                this.render(),
                                M(this.cid, this.a);
                        }
                        break;
                    }
                    case "ArrowDown": {
                        if (i === "r") {
                            (this.r = Math.max(0, r.r - 1)), (r.r = this.r);
                            let a = new l(r).toHsv();
                            b(this.cid, a.h, a.s, a.v),
                                (this.$r.value = this.r.toString()),
                                this.render();
                        }
                        if (i === "g") {
                            (this.g = Math.max(0, r.g - 1)), (r.g = this.g);
                            let a = new l(r).toHsv();
                            b(this.cid, a.h, a.s, a.v),
                                (this.$g.value = this.g.toString()),
                                this.render();
                        }
                        if (i === "b") {
                            (this.b = Math.max(0, r.b - 1)), (r.b = this.b);
                            let a = new l(r).toHsv();
                            b(this.cid, a.h, a.s, a.v),
                                (this.$b.value = this.b.toString()),
                                this.render();
                        }
                        if (i === "a") {
                            (this.a = Math.max(0, this.a - 0.01)),
                                (this.$a.value = Math.round(
                                    this.a * 100,
                                ).toString());
                            let a = this.color.toRgb();
                            (a.a = this.a),
                                (this.color = new l(a)),
                                this.render(),
                                M(this.cid, this.a);
                        }
                        break;
                    }
                    case "Escape": {
                        (n = this.shadowRoot) != null &&
                            n.activeElement &&
                            this.shadowRoot.activeElement.blur(),
                            this.render();
                        break;
                    }
                    case "Enter": {
                        (s = this.shadowRoot) != null &&
                            s.activeElement &&
                            this.shadowRoot.activeElement.blur(),
                            this.render();
                        break;
                    }
                }
            }
            onRedKeyDown(t) {
                this.onFieldKeyDown(t, "r");
            }
            onGreenKeyDown(t) {
                this.onFieldKeyDown(t, "g");
            }
            onBlueKeyDown(t) {
                this.onFieldKeyDown(t, "b");
            }
            onAlphaKeyDown(t) {
                this.onFieldKeyDown(t, "a");
            }
            onHexChange(t) {
                let i = t.target;
                if (i.value.length !== 6) return;
                let r = new l(`#${i.value}`);
                if (r.isValid) {
                    this.color = r;
                    let n = this.color.toHsv();
                    b(this.cid, n.h, n.s, n.v);
                }
            }
            onRedChange(t) {
                let i = t.target,
                    r = I(i.value);
                if (r.toString() === i.value) {
                    let n = this.color.toRgb();
                    n.r = r;
                    let s = new l(n).toHsv();
                    b(this.cid, s.h, s.s, s.v);
                }
            }
            onGreenChange(t) {
                let i = t.target,
                    r = I(i.value);
                if (r.toString() === i.value) {
                    let n = this.color.toRgb();
                    n.g = r;
                    let s = new l(n).toHsv();
                    b(this.cid, s.h, s.s, s.v);
                }
            }
            onBlueChange(t) {
                let i = t.target,
                    r = I(i.value);
                if (r.toString() === i.value) {
                    let n = this.color.toRgb();
                    n.b = r;
                    let s = new l(n).toHsv();
                    b(this.cid, s.h, s.s, s.v);
                }
            }
            onAlphaChange(t) {
                let i = t.target,
                    r = ft(i.value);
                r.toString() === i.value && M(this.cid, r / 100);
            }
            connectedCallback() {
                if (!this.shadowRoot) return;
                (this.cid = this.getAttribute("cid") || ""),
                    (this.color = c(this.getAttribute("color")));
                let t = this.color.toRgb();
                (this.r = t.r),
                    (this.g = t.g),
                    (this.b = t.b),
                    (this.a = t.a),
                    (this.hex = this.color.toHex());
                let i = $(),
                    r = $(),
                    n = $(),
                    s = $(),
                    a = $();
                (this.shadowRoot.innerHTML = `
           <style>${Et}</style>
           <div class="fields">
               <input id="hex-${i}" type="text" value="${this.hex.toUpperCase()}" data-type="hex" />
               <input id="r-${r}" type="text" value="${this.r}" data-type="r" />
               <input id="g-${n}" type="text" value="${this.g}" data-type="g" />
               <input id="b-${s}" type="text" value="${this.b}" data-type="b" />
               <input id="a-${a}" type="text" value="${Math.round(
                   this.a * 100,
               )}" data-type="a" />
               
               <label for="hex-${i}">Hex</label>
               <label for="r-${r}">R</label>
               <label for="g-${n}">G</label>
               <label for="b-${s}">B</label>
               <label for="a-${a}">A</label>
           </div>
        `),
                    (this.$hex = this.shadowRoot.getElementById(`hex-${i}`)),
                    (this.$r = this.shadowRoot.getElementById(`r-${r}`)),
                    (this.$g = this.shadowRoot.getElementById(`g-${n}`)),
                    (this.$b = this.shadowRoot.getElementById(`b-${s}`)),
                    (this.$a = this.shadowRoot.getElementById(`a-${a}`)),
                    document.addEventListener(p, this.hsvChanged),
                    document.addEventListener(f, this.hueChanged),
                    document.addEventListener(m, this.alphaChanged),
                    this.$hex.addEventListener("input", this.onHexChange),
                    this.$r.addEventListener("input", this.onRedChange),
                    this.$g.addEventListener("input", this.onGreenChange),
                    this.$b.addEventListener("input", this.onBlueChange),
                    this.$a.addEventListener("input", this.onAlphaChange),
                    this.$hex.addEventListener("blur", this.render),
                    this.$r.addEventListener("blur", this.render),
                    this.$g.addEventListener("blur", this.render),
                    this.$b.addEventListener("blur", this.render),
                    this.$a.addEventListener("blur", this.render),
                    this.$r.addEventListener("keydown", this.onRedKeyDown),
                    this.$g.addEventListener("keydown", this.onGreenKeyDown),
                    this.$b.addEventListener("keydown", this.onBlueKeyDown),
                    this.$a.addEventListener("keydown", this.onAlphaKeyDown);
            }
            disconnectedCallback() {
                document.removeEventListener(p, this.hsvChanged),
                    document.removeEventListener(f, this.hueChanged),
                    document.removeEventListener(m, this.alphaChanged),
                    this.$hex.removeEventListener("input", this.onHexChange),
                    this.$r.removeEventListener("input", this.onRedChange),
                    this.$g.removeEventListener("input", this.onGreenChange),
                    this.$b.removeEventListener("input", this.onBlueChange),
                    this.$a.removeEventListener("input", this.onAlphaChange),
                    this.$hex.removeEventListener("blur", this.render),
                    this.$r.removeEventListener("blur", this.render),
                    this.$g.removeEventListener("blur", this.render),
                    this.$b.removeEventListener("blur", this.render),
                    this.$a.removeEventListener("blur", this.render),
                    this.$r.removeEventListener("keydown", this.onRedKeyDown),
                    this.$g.removeEventListener("keydown", this.onGreenKeyDown),
                    this.$b.removeEventListener("keydown", this.onBlueKeyDown),
                    this.$a.removeEventListener("keydown", this.onAlphaKeyDown);
            }
            attributeChangedCallback(t, i, r) {
                (this.color = c(r)), this.render();
            }
        },
        Ct = J;
    var Z = class extends HTMLElement {
            constructor() {
                super();
                h(this, "cid");
                h(this, "popupPosition", "left");
                h(this, "$popup");
                h(this, "color", "#000");
                customElements.get("toolcool-color-picker-saturation") ||
                    customElements.define(
                        "toolcool-color-picker-saturation",
                        bt,
                    ),
                    customElements.get("toolcool-color-picker-hue") ||
                        customElements.define("toolcool-color-picker-hue", mt),
                    customElements.get("toolcool-color-picker-alpha") ||
                        customElements.define(
                            "toolcool-color-picker-alpha",
                            xt,
                        ),
                    customElements.get("toolcool-color-picker-fields") ||
                        customElements.define(
                            "toolcool-color-picker-fields",
                            Ct,
                        ),
                    (this.cid = this.getAttribute("cid") || ""),
                    (this.prevent = this.prevent.bind(this)),
                    this.attachShadow({ mode: "open" });
            }
            static get observedAttributes() {
                return ["color", "popup-position"];
            }
            prevent(t) {
                t.stopPropagation();
            }
            connectedCallback() {
                var t, i;
                !this.shadowRoot ||
                    ((this.color = this.getAttribute("color") || "#000"),
                    (this.popupPosition =
                        this.getAttribute("popup-position") || "left"),
                    (this.shadowRoot.innerHTML = `
           <style>${it}</style>
           <div class="popup">
                <toolcool-color-picker-saturation color="${this.color}" cid="${this.cid}"></toolcool-color-picker-saturation>
                <toolcool-color-picker-hue color="${this.color}" cid="${this.cid}"></toolcool-color-picker-hue>
                <toolcool-color-picker-alpha color="${this.color}" cid="${this.cid}"></toolcool-color-picker-alpha>
                <toolcool-color-picker-fields color="${this.color}" cid="${this.cid}"></toolcool-color-picker-fields>
           </div>
        `),
                    (this.$popup = this.shadowRoot.querySelector(".popup")),
                    (t = this.$popup) == null ||
                        t.addEventListener("mousedown", this.prevent),
                    (i = this.$popup) == null ||
                        i.classList.toggle(
                            "right",
                            this.popupPosition === "right",
                        ));
            }
            disconnectedCallback() {
                var t;
                (t = this.$popup) == null ||
                    t.removeEventListener("mousedown", this.prevent);
            }
            attributeChangedCallback(t, i, r) {
                var n, s, a, d;
                if (
                    (t === "popup-position" &&
                        ((this.popupPosition = r),
                        this.$popup &&
                            this.$popup.classList.toggle(
                                "right",
                                this.popupPosition === "right",
                            )),
                    t === "color")
                ) {
                    this.color = r;
                    let w =
                            (n = this.shadowRoot) == null
                                ? void 0
                                : n.querySelector(
                                      "toolcool-color-picker-saturation",
                                  ),
                        x =
                            (s = this.shadowRoot) == null
                                ? void 0
                                : s.querySelector("toolcool-color-picker-hue"),
                        R =
                            (a = this.shadowRoot) == null
                                ? void 0
                                : a.querySelector(
                                      "toolcool-color-picker-alpha",
                                  ),
                        et =
                            (d = this.shadowRoot) == null
                                ? void 0
                                : d.querySelector(
                                      "toolcool-color-picker-fields",
                                  );
                    w && w.setAttribute("color", this.color),
                        x && x.setAttribute("color", this.color),
                        R && R.setAttribute("color", this.color),
                        et && et.setAttribute("color", this.color);
                }
            }
        },
        yt = Z;
    var Ut = {
            sm: "0.875rem",
            md: "1.2rem",
            lg: "1.5rem",
            xl: "2.25rem",
            "2xl": "3rem",
            "3xl": "3.75rem",
            "4xl": "4.5rem",
        },
        tt = class extends HTMLElement {
            constructor() {
                super();
                h(this, "cid");
                h(this, "$button");
                h(this, "$buttonColor");
                h(this, "$popupBox");
                h(this, "stateDefaults", {
                    isPopupVisible: !1,
                    popupPosition: "left",
                    initialColor: new l("#000"),
                    color: new l("#000"),
                    buttonWidth: null,
                    buttonHeight: null,
                    buttonPadding: null,
                });
                h(this, "state");
                (this.cid = $()),
                    customElements.get("toolcool-color-picker-popup") ||
                        customElements.define(
                            "toolcool-color-picker-popup",
                            yt,
                        ),
                    this.attachShadow({ mode: "open" }),
                    (this.toggle = this.toggle.bind(this)),
                    (this.onKeyDown = this.onKeyDown.bind(this)),
                    (this.clickedOutside = this.clickedOutside.bind(this)),
                    (this.stopPropagation = this.stopPropagation.bind(this)),
                    (this.hsvChanged = this.hsvChanged.bind(this)),
                    (this.hueChanged = this.hueChanged.bind(this)),
                    (this.alphaChanged = this.alphaChanged.bind(this)),
                    (this.buttonClicked = this.buttonClicked.bind(this)),
                    (this.formatButtonSize = this.formatButtonSize.bind(this)),
                    this.initState();
            }
            static get observedAttributes() {
                return [
                    "color",
                    "popup-position",
                    "button-width",
                    "button-height",
                    "button-padding",
                ];
            }
            set color(t) {
                this.state.color = new l(t);
            }
            get color() {
                return this.state.color;
            }
            get hex() {
                return this.state.color.toHexString().toUpperCase();
            }
            get hex8() {
                return this.state.color.toHex8String().toUpperCase();
            }
            get rgb() {
                return this.state.color.toRgbString();
            }
            get rgba() {
                return S(this.state.color);
            }
            get hsl() {
                return this.state.color.toHslString();
            }
            get hsla() {
                return pt(this.state.color);
            }
            get hsv() {
                return this.state.color.toHsvString();
            }
            get hsva() {
                return gt(this.state.color);
            }
            get opened() {
                return this.state.isPopupVisible;
            }
            set opened(t) {
                this.state.isPopupVisible = t;
            }
            initState() {
                let t = this;
                this.state = new Proxy(t.stateDefaults, {
                    set(i, r, n, s) {
                        return (
                            (i[r] = n),
                            r === "isPopupVisible" &&
                                t.onPopupVisibilityChange(),
                            r === "popupPosition" && t.onPopupPosChange(),
                            r === "initialColor" && t.onInitialColorChange(),
                            r === "color" && t.onColorChange(),
                            (r === "buttonWidth" ||
                                r === "buttonHeight" ||
                                r === "buttonPadding") &&
                                t.setButtonSize(),
                            !0
                        );
                    },
                });
            }
            onPopupVisibilityChange() {
                !this.$popupBox ||
                    (this.$popupBox.innerHTML = this.state.isPopupVisible
                        ? `<toolcool-color-picker-popup color="${this.state.color.toRgbString()}" cid="${
                              this.cid
                          }" popup-position="${this.state.popupPosition}" />`
                        : "");
            }
            onPopupPosChange() {
                if (!this.$popupBox) return;
                let t = this.$popupBox.querySelector(
                    "toolcool-color-picker-popup",
                );
                !t ||
                    t.setAttribute("popup-position", this.state.popupPosition);
            }
            onInitialColorChange() {
                var r;
                let t = S(this.state.color);
                this.$buttonColor &&
                    (this.$buttonColor.style.backgroundColor = t);
                let i =
                    (r = this.shadowRoot) == null
                        ? void 0
                        : r.querySelector("toolcool-color-picker-popup");
                i && i.setAttribute("color", t);
            }
            setButtonSize() {
                !this.$button ||
                    (this.state.buttonWidth &&
                        (this.$button.style.width = this.formatButtonSize(
                            this.state.buttonWidth,
                        )),
                    this.state.buttonHeight &&
                        (this.$button.style.height = this.formatButtonSize(
                            this.state.buttonHeight,
                        )),
                    this.state.buttonPadding &&
                        (this.$button.style.padding =
                            this.state.buttonPadding));
            }
            onColorChange() {
                this.$buttonColor &&
                    (this.$buttonColor.style.backgroundColor = S(
                        this.state.color,
                    )),
                    this.dispatchEvent(
                        new CustomEvent("change", {
                            detail: {
                                hex: this.hex,
                                hex8: this.hex8,
                                rgb: this.rgb,
                                rgba: this.rgba,
                                hsl: this.hsl,
                                hsla: this.hsla,
                                hsv: this.hsv,
                                hsva: this.hsva,
                                color: this.color,
                            },
                        }),
                    );
            }
            hsvChanged(t) {
                !t ||
                    !t.detail ||
                    !t.detail.cid ||
                    (t.detail.cid === this.cid &&
                        (this.state.color = new l({
                            h: t.detail.h,
                            s: t.detail.s,
                            v: t.detail.v,
                            a: this.state.color.toHsv().a,
                        })));
            }
            hueChanged(t) {
                if (
                    !t ||
                    !t.detail ||
                    !t.detail.cid ||
                    t.detail.cid !== this.cid
                )
                    return;
                let i = this.state.color.toHsv();
                this.state.color = new l({
                    h: t.detail.h,
                    s: i.s,
                    v: i.v,
                    a: i.a,
                });
            }
            alphaChanged(t) {
                if (
                    !t ||
                    !t.detail ||
                    !t.detail.cid ||
                    t.detail.cid !== this.cid
                )
                    return;
                let i = this.state.color.toRgb();
                (i.a = t.detail.a), (this.state.color = new l(i));
            }
            buttonClicked(t) {
                !t ||
                    !t.detail ||
                    !t.detail.cid ||
                    (t.detail.cid !== this.cid &&
                        (this.state.isPopupVisible = !1));
            }
            clickedOutside() {
                this.state.isPopupVisible = !1;
            }
            toggle() {
                let t = this.state.isPopupVisible;
                window.setTimeout(() => {
                    (this.state.isPopupVisible = !t), nt(this.cid);
                }, 0);
            }
            onKeyDown(t) {
                t.key === "Escape" && (this.state.isPopupVisible = !1);
            }
            stopPropagation(t) {
                t.stopPropagation();
            }
            formatButtonSize(t) {
                var i;
                return (i = Ut[t]) != null ? i : t;
            }
            connectedCallback() {
                var t, i, r;
                !this.shadowRoot ||
                    ((this.state.initialColor = c(this.getAttribute("color"))),
                    (this.state.color = c(this.getAttribute("color"))),
                    (this.state.popupPosition =
                        this.getAttribute("popup-position") || "left"),
                    (this.state.buttonWidth =
                        this.getAttribute("button-width")),
                    (this.state.buttonHeight =
                        this.getAttribute("button-height")),
                    (this.state.buttonPadding =
                        this.getAttribute("button-padding")),
                    (this.shadowRoot.innerHTML = `
            <style>
                ${ot} 
            </style>
            <div class="color-picker" >
                <button
                    type="button"
                    tabIndex="0"
                    class="button"
                    title="Select Color">
                    <span class="button-color" style="background: ${S(
                        this.state.color,
                    )};"></span>
                </button>
                <div data-popup-box></div>
            </div>
        `),
                    (this.$button = this.shadowRoot.querySelector(".button")),
                    (this.$buttonColor =
                        this.shadowRoot.querySelector(".button-color")),
                    (t = this.$button) == null ||
                        t.addEventListener("click", this.toggle),
                    (i = this.$button) == null ||
                        i.addEventListener("keydown", this.onKeyDown),
                    (r = this.$button) == null ||
                        r.addEventListener("mousedown", this.stopPropagation),
                    (this.$popupBox =
                        this.shadowRoot.querySelector("[data-popup-box]")),
                    this.setButtonSize(),
                    document.addEventListener("mousedown", this.clickedOutside),
                    document.addEventListener(p, this.hsvChanged),
                    document.addEventListener(f, this.hueChanged),
                    document.addEventListener(m, this.alphaChanged),
                    document.addEventListener(D, this.buttonClicked));
            }
            disconnectedCallback() {
                var t, i, r;
                (t = this.$button) == null ||
                    t.removeEventListener("click", this.toggle),
                    (i = this.$button) == null ||
                        i.removeEventListener("keydown", this.onKeyDown),
                    (r = this.$button) == null ||
                        r.removeEventListener(
                            "mousedown",
                            this.stopPropagation,
                        ),
                    document.removeEventListener(
                        "mousedown",
                        this.clickedOutside,
                    ),
                    document.removeEventListener(p, this.hsvChanged),
                    document.removeEventListener(f, this.hueChanged),
                    document.removeEventListener(m, this.alphaChanged),
                    document.removeEventListener(D, this.buttonClicked);
            }
            attributeChangedCallback(t) {
                switch (t) {
                    case "color": {
                        (this.state.initialColor = c(
                            this.getAttribute("color"),
                        )),
                            (this.state.color = c(this.getAttribute("color"))),
                            this.onInitialColorChange();
                        break;
                    }
                    case "popup-position": {
                        (this.state.popupPosition =
                            this.getAttribute("popup-position") || "left"),
                            this.onPopupPosChange();
                        break;
                    }
                    case "button-width": {
                        (this.state.buttonWidth =
                            this.getAttribute("button-width")),
                            this.setButtonSize();
                        break;
                    }
                    case "button-height": {
                        (this.state.buttonHeight =
                            this.getAttribute("button-height")),
                            this.setButtonSize();
                        break;
                    }
                    case "button-padding": {
                        (this.state.buttonPadding =
                            this.getAttribute("button-padding")),
                            this.setButtonSize();
                        break;
                    }
                }
            }
        },
        $t = tt;
    customElements.get("toolcool-color-picker") ||
        customElements.define("toolcool-color-picker", $t);
})();
