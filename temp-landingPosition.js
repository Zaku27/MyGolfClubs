var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// node_modules/seedrandom/lib/alea.js
var require_alea = __commonJS({
  "node_modules/seedrandom/lib/alea.js"(exports, module) {
    (function(global, module2, define2) {
      function Alea(seed) {
        var me = this, mash = Mash();
        me.next = function() {
          var t = 2091639 * me.s0 + me.c * 23283064365386963e-26;
          me.s0 = me.s1;
          me.s1 = me.s2;
          return me.s2 = t - (me.c = t | 0);
        };
        me.c = 1;
        me.s0 = mash(" ");
        me.s1 = mash(" ");
        me.s2 = mash(" ");
        me.s0 -= mash(seed);
        if (me.s0 < 0) {
          me.s0 += 1;
        }
        me.s1 -= mash(seed);
        if (me.s1 < 0) {
          me.s1 += 1;
        }
        me.s2 -= mash(seed);
        if (me.s2 < 0) {
          me.s2 += 1;
        }
        mash = null;
      }
      function copy(f, t) {
        t.c = f.c;
        t.s0 = f.s0;
        t.s1 = f.s1;
        t.s2 = f.s2;
        return t;
      }
      function impl(seed, opts) {
        var xg = new Alea(seed), state = opts && opts.state, prng = xg.next;
        prng.int32 = function() {
          return xg.next() * 4294967296 | 0;
        };
        prng.double = function() {
          return prng() + (prng() * 2097152 | 0) * 11102230246251565e-32;
        };
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      function Mash() {
        var n = 4022871197;
        var mash = function(data) {
          data = String(data);
          for (var i = 0; i < data.length; i++) {
            n += data.charCodeAt(i);
            var h = 0.02519603282416938 * n;
            n = h >>> 0;
            h -= n;
            h *= n;
            n = h >>> 0;
            h -= n;
            n += h * 4294967296;
          }
          return (n >>> 0) * 23283064365386963e-26;
        };
        return mash;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.alea = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// node_modules/seedrandom/lib/xor128.js
var require_xor128 = __commonJS({
  "node_modules/seedrandom/lib/xor128.js"(exports, module) {
    (function(global, module2, define2) {
      function XorGen(seed) {
        var me = this, strseed = "";
        me.x = 0;
        me.y = 0;
        me.z = 0;
        me.w = 0;
        me.next = function() {
          var t = me.x ^ me.x << 11;
          me.x = me.y;
          me.y = me.z;
          me.z = me.w;
          return me.w ^= me.w >>> 19 ^ t ^ t >>> 8;
        };
        if (seed === (seed | 0)) {
          me.x = seed;
        } else {
          strseed += seed;
        }
        for (var k = 0; k < strseed.length + 64; k++) {
          me.x ^= strseed.charCodeAt(k) | 0;
          me.next();
        }
      }
      function copy(f, t) {
        t.x = f.x;
        t.y = f.y;
        t.z = f.z;
        t.w = f.w;
        return t;
      }
      function impl(seed, opts) {
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xor128 = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// node_modules/seedrandom/lib/xorwow.js
var require_xorwow = __commonJS({
  "node_modules/seedrandom/lib/xorwow.js"(exports, module) {
    (function(global, module2, define2) {
      function XorGen(seed) {
        var me = this, strseed = "";
        me.next = function() {
          var t = me.x ^ me.x >>> 2;
          me.x = me.y;
          me.y = me.z;
          me.z = me.w;
          me.w = me.v;
          return (me.d = me.d + 362437 | 0) + (me.v = me.v ^ me.v << 4 ^ (t ^ t << 1)) | 0;
        };
        me.x = 0;
        me.y = 0;
        me.z = 0;
        me.w = 0;
        me.v = 0;
        if (seed === (seed | 0)) {
          me.x = seed;
        } else {
          strseed += seed;
        }
        for (var k = 0; k < strseed.length + 64; k++) {
          me.x ^= strseed.charCodeAt(k) | 0;
          if (k == strseed.length) {
            me.d = me.x << 10 ^ me.x >>> 4;
          }
          me.next();
        }
      }
      function copy(f, t) {
        t.x = f.x;
        t.y = f.y;
        t.z = f.z;
        t.w = f.w;
        t.v = f.v;
        t.d = f.d;
        return t;
      }
      function impl(seed, opts) {
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xorwow = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// node_modules/seedrandom/lib/xorshift7.js
var require_xorshift7 = __commonJS({
  "node_modules/seedrandom/lib/xorshift7.js"(exports, module) {
    (function(global, module2, define2) {
      function XorGen(seed) {
        var me = this;
        me.next = function() {
          var X = me.x, i = me.i, t, v, w;
          t = X[i];
          t ^= t >>> 7;
          v = t ^ t << 24;
          t = X[i + 1 & 7];
          v ^= t ^ t >>> 10;
          t = X[i + 3 & 7];
          v ^= t ^ t >>> 3;
          t = X[i + 4 & 7];
          v ^= t ^ t << 7;
          t = X[i + 7 & 7];
          t = t ^ t << 13;
          v ^= t ^ t << 9;
          X[i] = v;
          me.i = i + 1 & 7;
          return v;
        };
        function init(me2, seed2) {
          var j, w, X = [];
          if (seed2 === (seed2 | 0)) {
            w = X[0] = seed2;
          } else {
            seed2 = "" + seed2;
            for (j = 0; j < seed2.length; ++j) {
              X[j & 7] = X[j & 7] << 15 ^ seed2.charCodeAt(j) + X[j + 1 & 7] << 13;
            }
          }
          while (X.length < 8) X.push(0);
          for (j = 0; j < 8 && X[j] === 0; ++j) ;
          if (j == 8) w = X[7] = -1;
          else w = X[j];
          me2.x = X;
          me2.i = 0;
          for (j = 256; j > 0; --j) {
            me2.next();
          }
        }
        init(me, seed);
      }
      function copy(f, t) {
        t.x = f.x.slice();
        t.i = f.i;
        return t;
      }
      function impl(seed, opts) {
        if (seed == null) seed = +/* @__PURE__ */ new Date();
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (state.x) copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xorshift7 = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// node_modules/seedrandom/lib/xor4096.js
var require_xor4096 = __commonJS({
  "node_modules/seedrandom/lib/xor4096.js"(exports, module) {
    (function(global, module2, define2) {
      function XorGen(seed) {
        var me = this;
        me.next = function() {
          var w = me.w, X = me.X, i = me.i, t, v;
          me.w = w = w + 1640531527 | 0;
          v = X[i + 34 & 127];
          t = X[i = i + 1 & 127];
          v ^= v << 13;
          t ^= t << 17;
          v ^= v >>> 15;
          t ^= t >>> 12;
          v = X[i] = v ^ t;
          me.i = i;
          return v + (w ^ w >>> 16) | 0;
        };
        function init(me2, seed2) {
          var t, v, i, j, w, X = [], limit = 128;
          if (seed2 === (seed2 | 0)) {
            v = seed2;
            seed2 = null;
          } else {
            seed2 = seed2 + "\0";
            v = 0;
            limit = Math.max(limit, seed2.length);
          }
          for (i = 0, j = -32; j < limit; ++j) {
            if (seed2) v ^= seed2.charCodeAt((j + 32) % seed2.length);
            if (j === 0) w = v;
            v ^= v << 10;
            v ^= v >>> 15;
            v ^= v << 4;
            v ^= v >>> 13;
            if (j >= 0) {
              w = w + 1640531527 | 0;
              t = X[j & 127] ^= v + w;
              i = 0 == t ? i + 1 : 0;
            }
          }
          if (i >= 128) {
            X[(seed2 && seed2.length || 0) & 127] = -1;
          }
          i = 127;
          for (j = 4 * 128; j > 0; --j) {
            v = X[i + 34 & 127];
            t = X[i = i + 1 & 127];
            v ^= v << 13;
            t ^= t << 17;
            v ^= v >>> 15;
            t ^= t >>> 12;
            X[i] = v ^ t;
          }
          me2.w = w;
          me2.X = X;
          me2.i = i;
        }
        init(me, seed);
      }
      function copy(f, t) {
        t.i = f.i;
        t.w = f.w;
        t.X = f.X.slice();
        return t;
      }
      ;
      function impl(seed, opts) {
        if (seed == null) seed = +/* @__PURE__ */ new Date();
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (state.X) copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.xor4096 = impl;
      }
    })(
      exports,
      // window object or global
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// node_modules/seedrandom/lib/tychei.js
var require_tychei = __commonJS({
  "node_modules/seedrandom/lib/tychei.js"(exports, module) {
    (function(global, module2, define2) {
      function XorGen(seed) {
        var me = this, strseed = "";
        me.next = function() {
          var b = me.b, c = me.c, d = me.d, a = me.a;
          b = b << 25 ^ b >>> 7 ^ c;
          c = c - d | 0;
          d = d << 24 ^ d >>> 8 ^ a;
          a = a - b | 0;
          me.b = b = b << 20 ^ b >>> 12 ^ c;
          me.c = c = c - d | 0;
          me.d = d << 16 ^ c >>> 16 ^ a;
          return me.a = a - b | 0;
        };
        me.a = 0;
        me.b = 0;
        me.c = 2654435769 | 0;
        me.d = 1367130551;
        if (seed === Math.floor(seed)) {
          me.a = seed / 4294967296 | 0;
          me.b = seed | 0;
        } else {
          strseed += seed;
        }
        for (var k = 0; k < strseed.length + 20; k++) {
          me.b ^= strseed.charCodeAt(k) | 0;
          me.next();
        }
      }
      function copy(f, t) {
        t.a = f.a;
        t.b = f.b;
        t.c = f.c;
        t.d = f.d;
        return t;
      }
      ;
      function impl(seed, opts) {
        var xg = new XorGen(seed), state = opts && opts.state, prng = function() {
          return (xg.next() >>> 0) / 4294967296;
        };
        prng.double = function() {
          do {
            var top = xg.next() >>> 11, bot = (xg.next() >>> 0) / 4294967296, result = (top + bot) / (1 << 21);
          } while (result === 0);
          return result;
        };
        prng.int32 = xg.next;
        prng.quick = prng;
        if (state) {
          if (typeof state == "object") copy(state, xg);
          prng.state = function() {
            return copy(xg, {});
          };
        }
        return prng;
      }
      if (module2 && module2.exports) {
        module2.exports = impl;
      } else if (define2 && define2.amd) {
        define2(function() {
          return impl;
        });
      } else {
        this.tychei = impl;
      }
    })(
      exports,
      typeof module == "object" && module,
      // present in node.js
      typeof define == "function" && define
      // present with an AMD loader
    );
  }
});

// (disabled):crypto
var require_crypto = __commonJS({
  "(disabled):crypto"() {
  }
});

// node_modules/seedrandom/seedrandom.js
var require_seedrandom = __commonJS({
  "node_modules/seedrandom/seedrandom.js"(exports, module) {
    (function(global, pool, math) {
      var width = 256, chunks = 6, digits = 52, rngname = "random", startdenom = math.pow(width, chunks), significance = math.pow(2, digits), overflow = significance * 2, mask = width - 1, nodecrypto;
      function seedrandom2(seed, options, callback) {
        var key = [];
        options = options == true ? { entropy: true } : options || {};
        var shortseed = mixkey(flatten(
          options.entropy ? [seed, tostring(pool)] : seed == null ? autoseed() : seed,
          3
        ), key);
        var arc4 = new ARC4(key);
        var prng = function() {
          var n = arc4.g(chunks), d = startdenom, x = 0;
          while (n < significance) {
            n = (n + x) * width;
            d *= width;
            x = arc4.g(1);
          }
          while (n >= overflow) {
            n /= 2;
            d /= 2;
            x >>>= 1;
          }
          return (n + x) / d;
        };
        prng.int32 = function() {
          return arc4.g(4) | 0;
        };
        prng.quick = function() {
          return arc4.g(4) / 4294967296;
        };
        prng.double = prng;
        mixkey(tostring(arc4.S), pool);
        return (options.pass || callback || function(prng2, seed2, is_math_call, state) {
          if (state) {
            if (state.S) {
              copy(state, arc4);
            }
            prng2.state = function() {
              return copy(arc4, {});
            };
          }
          if (is_math_call) {
            math[rngname] = prng2;
            return seed2;
          } else return prng2;
        })(
          prng,
          shortseed,
          "global" in options ? options.global : this == math,
          options.state
        );
      }
      function ARC4(key) {
        var t, keylen = key.length, me = this, i = 0, j = me.i = me.j = 0, s = me.S = [];
        if (!keylen) {
          key = [keylen++];
        }
        while (i < width) {
          s[i] = i++;
        }
        for (i = 0; i < width; i++) {
          s[i] = s[j = mask & j + key[i % keylen] + (t = s[i])];
          s[j] = t;
        }
        (me.g = function(count) {
          var t2, r = 0, i2 = me.i, j2 = me.j, s2 = me.S;
          while (count--) {
            t2 = s2[i2 = mask & i2 + 1];
            r = r * width + s2[mask & (s2[i2] = s2[j2 = mask & j2 + t2]) + (s2[j2] = t2)];
          }
          me.i = i2;
          me.j = j2;
          return r;
        })(width);
      }
      function copy(f, t) {
        t.i = f.i;
        t.j = f.j;
        t.S = f.S.slice();
        return t;
      }
      ;
      function flatten(obj, depth) {
        var result = [], typ = typeof obj, prop;
        if (depth && typ == "object") {
          for (prop in obj) {
            try {
              result.push(flatten(obj[prop], depth - 1));
            } catch (e) {
            }
          }
        }
        return result.length ? result : typ == "string" ? obj : obj + "\0";
      }
      function mixkey(seed, key) {
        var stringseed = seed + "", smear, j = 0;
        while (j < stringseed.length) {
          key[mask & j] = mask & (smear ^= key[mask & j] * 19) + stringseed.charCodeAt(j++);
        }
        return tostring(key);
      }
      function autoseed() {
        try {
          var out;
          if (nodecrypto && (out = nodecrypto.randomBytes)) {
            out = out(width);
          } else {
            out = new Uint8Array(width);
            (global.crypto || global.msCrypto).getRandomValues(out);
          }
          return tostring(out);
        } catch (e) {
          var browser = global.navigator, plugins = browser && browser.plugins;
          return [+/* @__PURE__ */ new Date(), global, plugins, global.screen, tostring(pool)];
        }
      }
      function tostring(a) {
        return String.fromCharCode.apply(0, a);
      }
      mixkey(math.random(), pool);
      if (typeof module == "object" && module.exports) {
        module.exports = seedrandom2;
        try {
          nodecrypto = require_crypto();
        } catch (ex) {
        }
      } else if (typeof define == "function" && define.amd) {
        define(function() {
          return seedrandom2;
        });
      } else {
        math["seed" + rngname] = seedrandom2;
      }
    })(
      // global: `self` in browsers (including strict mode and web workers),
      // otherwise `this` in Node and other environments
      typeof self !== "undefined" ? self : exports,
      [],
      // pool: entropy pool starts empty
      Math
      // math: package containing random, pow, and seedrandom
    );
  }
});

// node_modules/seedrandom/index.js
var require_seedrandom2 = __commonJS({
  "node_modules/seedrandom/index.js"(exports, module) {
    var alea = require_alea();
    var xor128 = require_xor128();
    var xorwow = require_xorwow();
    var xorshift7 = require_xorshift7();
    var xor4096 = require_xor4096();
    var tychei = require_tychei();
    var sr = require_seedrandom();
    sr.alea = alea;
    sr.xor128 = xor128;
    sr.xorwow = xorwow;
    sr.xorshift7 = xorshift7;
    sr.xor4096 = xor4096;
    sr.tychei = tychei;
    module.exports = sr;
  }
});

// src/utils/landingPosition.ts
var seedrandomModule = __toESM(require_seedrandom2(), 1);

// src/utils/analysisConstants.ts
var SWING_WEIGHT_BASE_LETTER_CODE = "D".charCodeAt(0);
var CLUB_TYPE_CATEGORY_MAP = {
  DRIVER: "driver",
  PUTTER: "putter",
  WOOD: "wood",
  HYBRID: "hybrid",
  IRON: "iron",
  WEDGE: "wedge",
  D: "wood",
  P: "putter",
  PW: "iron"
};
var DISTANCE_MODELS = {
  driver: {
    base: 255,
    speedCoeff: 4.8,
    loftCoeff: -4.25,
    min: 170,
    max: 350,
    standardLoft: 10.5
  },
  wood: {
    base: 225,
    speedCoeff: 4.3,
    loftCoeff: -4.25,
    min: 130,
    max: 290,
    standardLoft: 15
  },
  hybrid: {
    base: 195,
    speedCoeff: 3.8,
    loftCoeff: -3.25,
    min: 110,
    max: 250,
    standardLoft: 22
  },
  iron: {
    base: 165,
    speedCoeff: 3,
    loftCoeff: -2.75,
    min: 70,
    max: 220,
    standardLoft: 30
  },
  wedge: {
    base: 115,
    speedCoeff: 2.1,
    loftCoeff: -2.75,
    min: 40,
    max: 150,
    standardLoft: 46
  },
  putter: {
    base: 10,
    speedCoeff: 0,
    loftCoeff: 0,
    min: 1,
    max: 20,
    standardLoft: 0
  }
};

// src/utils/analysisGeometry.ts
var clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// src/utils/analysisUtils.ts
var inferCategoryFromClubTypeCode = (normalizedClubType) => {
  if (normalizedClubType.endsWith("W")) return "wood";
  if (normalizedClubType.endsWith("H")) return "hybrid";
  if (normalizedClubType.endsWith("I")) return "iron";
  return "wedge";
};
var getClubCategoryByType = (clubType) => {
  const normalizedClubType = (clubType ?? "").trim().toUpperCase();
  const mappedCategory = CLUB_TYPE_CATEGORY_MAP[normalizedClubType];
  if (mappedCategory) return mappedCategory;
  return inferCategoryFromClubTypeCode(normalizedClubType);
};
var LOW_LOFT_PENALTY_LIMIT = 18;
var LOW_LOFT_PENALTY_REFERENCE = 10.5;
var LOW_LOFT_MAX_PENALTY = 20;
var LOW_LOFT_SPEED_RELIEF = 0.14;
var DRIVER_BOOST_RAMP_START = 43;
var DRIVER_BOOST_RAMP_END = 45;
var DRIVER_BOOST_AT_45 = 10.5;
var DRIVER_BOOST_ABOVE_45_PER_SPEED = 4;
var getEstimatedDistance = (club, headSpeed) => {
  const loftAngle = club.loftAngle ?? 0;
  const category = getClubCategoryByType(club.clubType ?? "");
  const model = DISTANCE_MODELS[category];
  let estimated = model.base + (headSpeed - 44.5) * model.speedCoeff + (loftAngle - model.standardLoft) * model.loftCoeff;
  const effectiveLoft = loftAngle > 0 ? loftAngle : model.standardLoft;
  if (category !== "putter" && effectiveLoft < LOW_LOFT_PENALTY_LIMIT) {
    const loftRatio = clamp(
      (LOW_LOFT_PENALTY_LIMIT - effectiveLoft) / (LOW_LOFT_PENALTY_LIMIT - LOW_LOFT_PENALTY_REFERENCE),
      0,
      1
    );
    const loftPenalty = LOW_LOFT_MAX_PENALTY * loftRatio * loftRatio;
    const speedRelief = Math.max(0, headSpeed - 30) * LOW_LOFT_SPEED_RELIEF * loftRatio * loftRatio;
    estimated -= loftPenalty;
    estimated += speedRelief;
  }
  if (category === "driver" && headSpeed > DRIVER_BOOST_RAMP_START) {
    const rampRange = DRIVER_BOOST_RAMP_END - DRIVER_BOOST_RAMP_START;
    const rampRatio = clamp((headSpeed - DRIVER_BOOST_RAMP_START) / rampRange, 0, 1);
    const rampBoost = DRIVER_BOOST_AT_45 * rampRatio * rampRatio;
    const highSpeedBoost = headSpeed > DRIVER_BOOST_RAMP_END ? (headSpeed - DRIVER_BOOST_RAMP_END) * DRIVER_BOOST_ABOVE_45_PER_SPEED : 0;
    estimated += rampBoost + highSpeedBoost;
  }
  estimated = Math.max(model.min, Math.min(model.max, estimated));
  return Math.round(estimated);
};

// src/utils/distanceEstimation.ts
function toDistanceModelGolfClub(club) {
  return {
    id: 0,
    clubType: club.clubType,
    name: club.name ?? "",
    number: club.number ?? "",
    length: club.length ?? 0,
    weight: club.weight ?? 0,
    swingWeight: club.swingWeight ?? "",
    lieAngle: club.lieAngle ?? 0,
    loftAngle: club.loftAngle ?? 0,
    shaftType: club.shaftType ?? "",
    torque: club.torque ?? 0,
    flex: club.flex ?? "S",
    distance: club.distance ?? 0,
    notes: club.notes ?? ""
  };
}
function estimateTheoreticalDistance(club, headSpeed) {
  const golfClub = toDistanceModelGolfClub(club);
  return getEstimatedDistance(golfClub, headSpeed);
}

// src/utils/landingPosition.ts
var seedrandom = seedrandomModule.default ?? seedrandomModule;
var DEFAULT_HEAD_SPEED = 44.5;
var GLOBAL_CARRY_TUNING = 1;
var DISPERSION_SKILL_CURVE_POWER = 1.8;
var LOW_SKILL_NEAR_TARGET_RADIUS = 15;
var LOW_SKILL_AVOID_START_SKILL = 0.45;
var LOW_SKILL_AVOID_FULL_SKILL = 0.15;
var MAX_GROUND_SLOPE_ANGLE = 60;
var HARDNESS_MULTIPLIER_BY_TYPE = {
  firm: 1.35,
  medium: 1,
  soft: 0.65
};
var MAX_SLOPE_DISPERSION_BONUS = 0.35;
var SOFT_GROUND_MISHIT_BONUS = 0.06;
var UPHILL_MISHIT_BONUS_PER_DEGREE = 25e-4;
var GROUND_CONDITION_SEED_PREFIX = "ground-condition";
function clamp2(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function randomInRange(rng, min, max) {
  return min + (max - min) * rng();
}
function normalizeSkillValue(raw) {
  if (raw <= 1) return clamp2(raw, 0, 1);
  return clamp2(raw / 100, 0, 1);
}
function buildDeterministicSeed(input) {
  if (input.conditions?.seed) {
    return input.conditions.seed;
  }
  const { club, skillLevel, aimXOffset, conditions } = input;
  return [
    club.clubType,
    club.name,
    club.number,
    club.loftAngle,
    club.distance,
    skillLevel.dispersion,
    skillLevel.mishitRate,
    skillLevel.sideSpinDispersion,
    input.executionQuality ?? "auto",
    aimXOffset,
    conditions?.wind ?? 0,
    conditions?.groundHardness ?? 50,
    conditions?.headSpeed ?? DEFAULT_HEAD_SPEED
  ].join("|");
}
function buildGroundConditionSeed(landingResult, ground, club, skillLevel) {
  return [
    GROUND_CONDITION_SEED_PREFIX,
    club.clubType,
    club.name,
    club.number,
    club.loftAngle,
    club.distance,
    landingResult.carry,
    landingResult.roll,
    landingResult.lateralDeviation,
    ground.hardness,
    ground.slopeAngle,
    ground.slopeDirection,
    skillLevel.dispersion,
    skillLevel.mishitRate,
    skillLevel.sideSpinDispersion
  ].join("|");
}
function clampGroundSlopeAngle(angle) {
  return clamp2(angle, -MAX_GROUND_SLOPE_ANGLE, MAX_GROUND_SLOPE_ANGLE);
}
function applyGroundCondition(landingResult, ground, club, skillLevel) {
  const rng = seedrandom(buildGroundConditionSeed(landingResult, ground, club, skillLevel));
  const hardnessMultiplier = HARDNESS_MULTIPLIER_BY_TYPE[ground.hardness];
  const adjustedSlopeAngle = clampGroundSlopeAngle(ground.slopeAngle);
  const slopeFactor = Math.cos(adjustedSlopeAngle * Math.PI / 180);
  const adjustedRoll = Math.max(0, landingResult.roll * hardnessMultiplier * slopeFactor);
  const slopeStrength = Math.min(1, Math.abs(adjustedSlopeAngle) / 45);
  const dispersionMultiplier = 1 + slopeStrength * MAX_SLOPE_DISPERSION_BONUS;
  const mishitRateBonus = (ground.hardness === "soft" ? SOFT_GROUND_MISHIT_BONUS : 0) + (adjustedSlopeAngle > 0 ? Math.min(0.12, adjustedSlopeAngle * UPHILL_MISHIT_BONUS_PER_DEGREE) : 0);
  const adjustedLateralDeviation = landingResult.lateralDeviation * dispersionMultiplier;
  const slopeDirectionRad = (ground.slopeDirection % 360 + 360) % 360 * (Math.PI / 180);
  const slopeShift = sampleTruncatedNormal(rng, slopeStrength * 0.35, 1) * 2 * Math.sin(slopeDirectionRad);
  const finalX = landingResult.finalX + (adjustedLateralDeviation - landingResult.lateralDeviation) + slopeShift;
  const finalY = Math.max(0, landingResult.carry + adjustedRoll);
  const totalDistance = finalY;
  const apexHeight = calculateApexHeight(club.loftAngle, landingResult.carry);
  const trajectoryPoints = buildTrajectoryPoints(finalX, finalY, apexHeight);
  return {
    ...landingResult,
    roll: Math.round(adjustedRoll * 10) / 10,
    totalDistance: Math.round(totalDistance * 10) / 10,
    lateralDeviation: Math.round(adjustedLateralDeviation * 10) / 10,
    finalX: Math.round(finalX * 10) / 10,
    finalY: Math.round(finalY * 10) / 10,
    apexHeight: Math.round(apexHeight * 10) / 10,
    trajectoryPoints: trajectoryPoints.map((p) => ({
      x: Math.round(p.x * 10) / 10,
      y: Math.round(p.y * 10) / 10,
      z: Math.round(p.z * 10) / 10
    })),
    nextShotAdjustment: {
      dispersionMultiplier: Math.round(dispersionMultiplier * 100) / 100,
      mishitRateBonus: Math.round(mishitRateBonus * 100) / 100,
      groundCondition: ground
    }
  };
}
function sampleStandardNormal(rng) {
  const u1 = Math.max(1e-9, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}
function sampleTruncatedNormal(rng, sigma, maxSigma = 1.5) {
  const value = sampleStandardNormal(rng);
  const clipped = Math.max(-maxSigma, Math.min(maxSigma, value));
  return clipped * sigma;
}
function buildForcedExecutionProfile(quality) {
  if (quality === "excellent") {
    return { quality, carrySigmaMultiplier: 0.45, lateralSigmaMultiplier: 0.45, carryBiasRatio: 0.02 };
  }
  if (quality === "good") {
    return { quality, carrySigmaMultiplier: 0.75, lateralSigmaMultiplier: 0.75, carryBiasRatio: 0 };
  }
  if (quality === "average") {
    return { quality, carrySigmaMultiplier: 1, lateralSigmaMultiplier: 1, carryBiasRatio: -0.01 };
  }
  if (quality === "poor") {
    return { quality, carrySigmaMultiplier: 1.35, lateralSigmaMultiplier: 1.45, carryBiasRatio: -0.08 };
  }
  return { quality, carrySigmaMultiplier: 1.85, lateralSigmaMultiplier: 2.1, carryBiasRatio: -0.2 };
}
function getBaseDispersionByClubType(clubType) {
  if (clubType === "Driver") {
    return { carrySigmaLow: 6, carrySigmaHigh: 20, lateralSigmaLow: 10, lateralSigmaHigh: 35, mishitLow: 0.04, mishitHigh: 0.24 };
  }
  if (clubType === "Wood") {
    return { carrySigmaLow: 6, carrySigmaHigh: 16, lateralSigmaLow: 9, lateralSigmaHigh: 30, mishitLow: 0.04, mishitHigh: 0.21 };
  }
  if (clubType === "Hybrid") {
    return { carrySigmaLow: 5, carrySigmaHigh: 14, lateralSigmaLow: 8, lateralSigmaHigh: 26, mishitLow: 0.04, mishitHigh: 0.2 };
  }
  if (clubType === "Iron") {
    return { carrySigmaLow: 4, carrySigmaHigh: 12, lateralSigmaLow: 6, lateralSigmaHigh: 20, mishitLow: 0.03, mishitHigh: 0.16 };
  }
  if (clubType === "Wedge") {
    return { carrySigmaLow: 3, carrySigmaHigh: 9, lateralSigmaLow: 4, lateralSigmaHigh: 12, mishitLow: 0.02, mishitHigh: 0.12 };
  }
  return { carrySigmaLow: 1, carrySigmaHigh: 4, lateralSigmaLow: 1, lateralSigmaHigh: 4, mishitLow: 0.01, mishitHigh: 0.08 };
}
function buildDispersionProfile(club, skillLevel) {
  const skill01 = 1 - normalizeSkillValue(skillLevel.dispersion);
  const mishitSkill01 = 1 - normalizeSkillValue(skillLevel.mishitRate);
  const sideSkill01 = 1 - normalizeSkillValue(skillLevel.sideSpinDispersion);
  const base = getBaseDispersionByClubType(club.clubType);
  const carrySkillCurve = Math.pow(clamp2(skill01, 0, 1), DISPERSION_SKILL_CURVE_POWER);
  const lateralSkillCurve = Math.pow(clamp2(sideSkill01, 0, 1), DISPERSION_SKILL_CURVE_POWER);
  const carrySigma = base.carrySigmaHigh - (base.carrySigmaHigh - base.carrySigmaLow) * carrySkillCurve;
  const lateralSigma = base.lateralSigmaHigh - (base.lateralSigmaHigh - base.lateralSigmaLow) * lateralSkillCurve;
  const mishitSkillCurve = Math.pow(clamp2(mishitSkill01, 0, 1), 1.7);
  const mishitProbability = base.mishitHigh - (base.mishitHigh - base.mishitLow) * mishitSkillCurve;
  const effectiveSkill = clamp2((skill01 + mishitSkill01 + sideSkill01) / 3, 0, 1);
  return {
    carrySigma: Math.max(1, carrySigma),
    lateralSigma: Math.max(1, lateralSigma),
    mishitProbability: clamp2(mishitProbability, 3e-3, 0.4),
    effectiveSkill
  };
}
function classifyQualityByOutcome(carry, expectedCarry, clubType, lateralDeviation, profile, wasMishitSampled) {
  const carryDelta = carry - expectedCarry;
  const rawCarryZ = Math.abs(carryDelta) / Math.max(1e-6, profile.carrySigma);
  const carryZ = clubType === "Driver" && carryDelta > 0 ? 0 : rawCarryZ;
  const lateralZ = Math.abs(lateralDeviation) / Math.max(1e-6, profile.lateralSigma);
  const weightedCarry = carryZ * 1.1;
  const weightedLateral = lateralZ * 0.75;
  const score = Math.max(weightedCarry, weightedLateral);
  const poorThreshold = 1.6;
  const decisiveAxis = Math.abs(weightedCarry - weightedLateral) < 0.05 ? "mixed" : weightedCarry > weightedLateral ? "carry" : "lateral";
  const metrics = {
    carryZ,
    lateralZ,
    weightedCarry,
    weightedLateral,
    score,
    poorThreshold,
    decisiveAxis
  };
  if (wasMishitSampled) return { quality: "mishit", metrics };
  if (score < 0.65) return { quality: "excellent", metrics };
  if (score < 1) return { quality: "good", metrics };
  if (score < poorThreshold) return { quality: "average", metrics };
  return { quality: "poor", metrics };
}
function applyLowSkillTargetAvoidance(carry, lateralDeviation, expectedCarry, effectiveSkill, rng) {
  const avoidanceStrength = clamp2(
    (LOW_SKILL_AVOID_START_SKILL - effectiveSkill) / (LOW_SKILL_AVOID_START_SKILL - LOW_SKILL_AVOID_FULL_SKILL),
    0,
    1
  );
  if (avoidanceStrength <= 0) {
    return { carry, lateralDeviation };
  }
  const carryDelta = carry - expectedCarry;
  const distanceFromTarget = Math.hypot(lateralDeviation, carryDelta);
  if (distanceFromTarget > LOW_SKILL_NEAR_TARGET_RADIUS) {
    return { carry, lateralDeviation };
  }
  const avoidChance = 0.65 + avoidanceStrength * 0.35;
  if (rng() > avoidChance) {
    return { carry, lateralDeviation };
  }
  const angle = distanceFromTarget > 1e-6 ? Math.atan2(carryDelta, lateralDeviation) : randomInRange(rng, -Math.PI, Math.PI);
  const pushedDistance = randomInRange(
    rng,
    LOW_SKILL_NEAR_TARGET_RADIUS + 1,
    LOW_SKILL_NEAR_TARGET_RADIUS + 8 + 14 * avoidanceStrength
  );
  return {
    carry: expectedCarry + Math.sin(angle) * pushedDistance,
    lateralDeviation: Math.cos(angle) * pushedDistance
  };
}
function extractClubNumber(numberText) {
  const match = numberText.trim().toUpperCase().match(/^(\d{1,2})/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}
function getRollRateByClub(club) {
  const clubType = club.clubType;
  const clubNumber = extractClubNumber(club.number ?? "");
  if (clubType === "Driver") return 0.09;
  if (clubType === "Wood") {
    if (clubNumber !== null) {
      if (clubNumber <= 3) return 0.085;
      if (clubNumber <= 5) return 0.075;
      if (clubNumber <= 7) return 0.065;
      return 0.055;
    }
    return (club.loftAngle ?? 15) <= 16 ? 0.08 : 0.065;
  }
  if (clubType === "Hybrid") {
    if (clubNumber !== null) {
      if (clubNumber <= 3) return 0.075;
      if (clubNumber <= 4) return 0.068;
      if (clubNumber <= 5) return 0.06;
      return 0.052;
    }
    return (club.loftAngle ?? 22) <= 21 ? 0.07 : 0.058;
  }
  if (clubType === "Iron") {
    if (clubNumber !== null) {
      if (clubNumber <= 4) return 0.06;
      if (clubNumber <= 6) return 0.052;
      if (clubNumber <= 8) return 0.042;
      return 0.032;
    }
    return (club.loftAngle ?? 30) <= 28 ? 0.052 : 0.038;
  }
  if (clubType === "Wedge") {
    const token = (club.number ?? "").trim().toUpperCase();
    if (token.includes("LW")) return 0.012;
    if (token.includes("SW")) return 0.016;
    if (token.includes("GW") || token.includes("AW")) return 0.02;
    if (token.includes("PW")) return 0.024;
    return (club.loftAngle ?? 50) >= 56 ? 0.014 : 0.022;
  }
  return 0.01;
}
function calculateRollDistance(carry, club, groundHardness, executionQuality) {
  const baseRollRate = getRollRateByClub(club);
  const groundHardness01 = clamp2(groundHardness, 0, 100) / 100;
  const groundFactor = 0.8 + groundHardness01 * 0.4;
  const qualityFactor = executionQuality === "excellent" ? 1.06 : executionQuality === "good" ? 1.02 : executionQuality === "average" ? 0.98 : executionQuality === "poor" ? 0.9 : 0.82;
  const rawRoll = Math.max(0, carry * baseRollRate * groundFactor * qualityFactor);
  const maxRollRateByClub = club.clubType === "Driver" ? 0.16 : club.clubType === "Wood" ? 0.13 : club.clubType === "Hybrid" ? 0.11 : club.clubType === "Iron" ? 0.08 : club.clubType === "Wedge" ? 0.05 : 0.03;
  const maxRoll = carry * maxRollRateByClub;
  return Math.min(rawRoll, maxRoll);
}
function estimateCarryFromTotalDistance(estimatedTotalDistance, club, groundHardness) {
  const baseRollRate = getRollRateByClub(club);
  const groundHardness01 = clamp2(groundHardness, 0, 100) / 100;
  const groundFactor = 0.8 + groundHardness01 * 0.4;
  const typicalQualityFactor = 0.98;
  const effectiveRollRate = Math.max(0, baseRollRate * groundFactor * typicalQualityFactor);
  const carry = estimatedTotalDistance / (1 + effectiveRollRate);
  return Math.max(1, carry * GLOBAL_CARRY_TUNING);
}
function calculateApexHeight(loftAngle, carry) {
  const loftFactor = clamp2(loftAngle, 3, 62) / 62;
  const carryFactor = Math.sqrt(Math.max(1, carry)) * 0.7;
  return loftFactor * carryFactor;
}
function buildTrajectoryPoints(finalX, finalY, apexHeight) {
  const points = [];
  const stepCount = 10;
  for (let i = 0; i <= stepCount; i += 1) {
    const t = i / stepCount;
    const y = finalY * t;
    const x = finalX * t;
    const z = 4 * apexHeight * t * (1 - t);
    points.push({ x, y, z });
  }
  return points;
}
function calculateLandingOutcome(input) {
  const rng = seedrandom(buildDeterministicSeed(input));
  const headSpeed = input.conditions?.headSpeed ?? DEFAULT_HEAD_SPEED;
  const wind = input.conditions?.wind ?? 0;
  const groundHardness = input.conditions?.groundHardness ?? 50;
  const estimatedTotalDistance = (input.conditions?.baseDistanceOverride ?? 0) > 0 ? input.conditions.baseDistanceOverride : estimateTheoreticalDistance(input.club, headSpeed);
  const expectedCarry = estimateCarryFromTotalDistance(estimatedTotalDistance, input.club, groundHardness);
  const profile = buildDispersionProfile(input.club, input.skillLevel);
  const forcedQuality = input.executionQuality;
  const isForced = typeof forcedQuality === "string";
  let carry;
  let lateralDeviation;
  let resolvedQuality;
  let qualityMetrics;
  if (isForced && forcedQuality) {
    const forced = buildForcedExecutionProfile(forcedQuality);
    const carryNoise = sampleStandardNormal(rng) * profile.carrySigma * forced.carrySigmaMultiplier;
    carry = expectedCarry * (1 + forced.carryBiasRatio) + carryNoise;
    const startLine = sampleStandardNormal(rng) * profile.lateralSigma * 0.7 * forced.lateralSigmaMultiplier;
    const curve = sampleStandardNormal(rng) * profile.lateralSigma * 0.45 * forced.lateralSigmaMultiplier;
    lateralDeviation = startLine + curve;
    const forcedResult = classifyQualityByOutcome(
      carry,
      expectedCarry,
      input.club.clubType,
      lateralDeviation,
      profile,
      forcedQuality === "mishit"
    );
    resolvedQuality = forcedQuality;
    qualityMetrics = forcedResult.metrics;
  } else {
    const isPerfectRobot = input.skillLevel.dispersion === 0 && input.skillLevel.mishitRate === 0 && input.skillLevel.sideSpinDispersion === 0;
    let wasMishit = rng() < profile.mishitProbability;
    if (isPerfectRobot) {
      wasMishit = false;
    }
    if (wasMishit) {
      const noviceFactor = 1 - profile.effectiveSkill;
      const minCarryRate = 0.78 - noviceFactor * 0.42;
      const maxCarryRate = 0.95 - noviceFactor * 0.14;
      carry = expectedCarry * randomInRange(rng, minCarryRate, maxCarryRate);
      const lateralMin = 1.15 + noviceFactor * 0.65;
      const lateralMax = 1.65 + noviceFactor * 1.45;
      const lateralScale = randomInRange(rng, lateralMin, lateralMax);
      const startLine = sampleStandardNormal(rng) * profile.lateralSigma * lateralScale;
      const curve = sampleStandardNormal(rng) * profile.lateralSigma * 0.8 * lateralScale;
      lateralDeviation = startLine + curve;
      const adjusted = applyLowSkillTargetAvoidance(carry, lateralDeviation, expectedCarry, profile.effectiveSkill, rng);
      carry = adjusted.carry;
      lateralDeviation = adjusted.lateralDeviation;
      const classified = classifyQualityByOutcome(
        carry,
        expectedCarry,
        input.club.clubType,
        lateralDeviation,
        profile,
        true
      );
      resolvedQuality = classified.quality;
      qualityMetrics = classified.metrics;
    } else {
      if (isPerfectRobot) {
        carry = expectedCarry + sampleTruncatedNormal(rng, profile.carrySigma, 1.25);
        const startLine = sampleTruncatedNormal(rng, profile.lateralSigma * 0.25, 1.25);
        const curve = sampleTruncatedNormal(rng, profile.lateralSigma * 0.15, 1.25);
        lateralDeviation = startLine + curve;
      } else {
        carry = expectedCarry + sampleStandardNormal(rng) * profile.carrySigma;
        const startLine = sampleStandardNormal(rng) * profile.lateralSigma * 0.75;
        const curve = sampleStandardNormal(rng) * profile.lateralSigma * 0.4;
        lateralDeviation = startLine + curve;
      }
      const adjusted = applyLowSkillTargetAvoidance(carry, lateralDeviation, expectedCarry, profile.effectiveSkill, rng);
      carry = adjusted.carry;
      lateralDeviation = adjusted.lateralDeviation;
      const classified = classifyQualityByOutcome(
        carry,
        expectedCarry,
        input.club.clubType,
        lateralDeviation,
        profile,
        false
      );
      resolvedQuality = classified.quality;
      qualityMetrics = classified.metrics;
    }
  }
  carry += wind * 0.8;
  carry = Math.max(1, carry);
  const roll = calculateRollDistance(carry, input.club, groundHardness, resolvedQuality);
  const finalX = input.aimXOffset + lateralDeviation;
  const finalY = carry + roll;
  const totalDistance = finalY;
  const apexHeight = calculateApexHeight(input.club.loftAngle, carry);
  const trajectoryPoints = buildTrajectoryPoints(finalX, finalY, apexHeight);
  return {
    shotQuality: resolvedQuality,
    landing: {
      carry: Math.round(carry * 10) / 10,
      roll: Math.round(roll * 10) / 10,
      totalDistance: Math.round(totalDistance * 10) / 10,
      lateralDeviation: Math.round(lateralDeviation * 10) / 10,
      finalX: Math.round(finalX * 10) / 10,
      finalY: Math.round(finalY * 10) / 10,
      qualityMetrics: {
        carryZ: Math.round(qualityMetrics.carryZ * 100) / 100,
        lateralZ: Math.round(qualityMetrics.lateralZ * 100) / 100,
        weightedCarry: Math.round(qualityMetrics.weightedCarry * 100) / 100,
        weightedLateral: Math.round(qualityMetrics.weightedLateral * 100) / 100,
        score: Math.round(qualityMetrics.score * 100) / 100,
        poorThreshold: qualityMetrics.poorThreshold,
        decisiveAxis: qualityMetrics.decisiveAxis
      },
      apexHeight: Math.round(apexHeight * 10) / 10,
      trajectoryPoints: trajectoryPoints.map((p) => ({
        x: Math.round(p.x * 10) / 10,
        y: Math.round(p.y * 10) / 10,
        z: Math.round(p.z * 10) / 10
      }))
    }
  };
}
function calculateLandingPosition(input) {
  return calculateLandingOutcome(input).landing;
}
export {
  applyGroundCondition,
  calculateLandingOutcome,
  calculateLandingPosition
};
