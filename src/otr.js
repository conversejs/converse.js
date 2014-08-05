/*!

  otr.js v0.2.12 - 2014-04-15
  (c) 2014 - Arlo Breault <arlolra@gmail.com>
  Freely distributed under the MPL v2.0 license.

  This file is concatenated for the browser.
  Please see: https://github.com/arlolra/otr

*/

;(function (root, factory) {

  if (typeof define === 'function' && define.amd) {
    define([
        "bigint"
      , "crypto"
      , "eventemitter"
    ], function (BigInt, CryptoJS, EventEmitter) {
      if ($.browser.msie) {
          return undefined;
      }
      var root = {
          BigInt: BigInt
        , CryptoJS: CryptoJS
        , EventEmitter: EventEmitter
        , OTR: {}
        , DSA: {}
      }
      return factory.call(root)
    })
  } else {
    root.OTR = {}
    root.DSA = {}
    factory.call(root)
  }

}(this, function () {

;(function () {
  "use strict";

  var root = this

  var CONST = {

    // diffie-heilman
      N : 'FFFFFFFFFFFFFFFFC90FDAA22168C234C4C6628B80DC1CD129024E088A67CC74020BBEA63B139B22514A08798E3404DDEF9519B3CD3A431B302B0A6DF25F14374FE1356D6D51C245E485B576625E7EC6F44C42E9A637ED6B0BFF5CB6F406B7EDEE386BFB5A899FA5AE9F24117C4B1FE649286651ECE45B3DC2007CB8A163BF0598DA48361C55D39A69163FA8FD24CF5F83655D23DCA3AD961C62F356208552BB9ED529077096966D670C354E4ABC9804F1746C08CA237327FFFFFFFFFFFFFFFF'
    , G : '2'

    // otr message states
    , MSGSTATE_PLAINTEXT : 0
    , MSGSTATE_ENCRYPTED : 1
    , MSGSTATE_FINISHED  : 2

    // otr auth states
    , AUTHSTATE_NONE               : 0
    , AUTHSTATE_AWAITING_DHKEY     : 1
    , AUTHSTATE_AWAITING_REVEALSIG : 2
    , AUTHSTATE_AWAITING_SIG       : 3

    // whitespace tags
    , WHITESPACE_TAG    : '\x20\x09\x20\x20\x09\x09\x09\x09\x20\x09\x20\x09\x20\x09\x20\x20'
    , WHITESPACE_TAG_V2 : '\x20\x20\x09\x09\x20\x20\x09\x20'
    , WHITESPACE_TAG_V3 : '\x20\x20\x09\x09\x20\x20\x09\x09'

    // otr tags
    , OTR_TAG       : '?OTR'
    , OTR_VERSION_1 : '\x00\x01'
    , OTR_VERSION_2 : '\x00\x02'
    , OTR_VERSION_3 : '\x00\x03'

    // smp machine states
    , SMPSTATE_EXPECT0 : 0
    , SMPSTATE_EXPECT1 : 1
    , SMPSTATE_EXPECT2 : 2
    , SMPSTATE_EXPECT3 : 3
    , SMPSTATE_EXPECT4 : 4

    // unstandard status codes
    , STATUS_SEND_QUERY  : 0
    , STATUS_AKE_INIT    : 1
    , STATUS_AKE_SUCCESS : 2
    , STATUS_END_OTR     : 3

  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONST
  } else {
    root.OTR.CONST = CONST
  }

}).call(this)
;(function () {
  "use strict";

  var root = this

  var HLP = {}, CryptoJS, BigInt
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = HLP = {}
    CryptoJS = require('../vendor/crypto.js')
    BigInt = require('../vendor/bigint.js')
  } else {
    if (root.OTR) root.OTR.HLP = HLP
    if (root.DSA) root.DSA.HLP = HLP
    CryptoJS = root.CryptoJS
    BigInt = root.BigInt
  }

  // data types (byte lengths)
  var DTS = {
      BYTE  : 1
    , SHORT : 2
    , INT   : 4
    , CTR   : 8
    , MAC   : 20
    , SIG   : 40
  }

  // otr message wrapper begin and end
  var WRAPPER_BEGIN = "?OTR"
    , WRAPPER_END   = "."

  var TWO = BigInt.str2bigInt('2', 10)

  HLP.debug = function (msg) {
    // used as HLP.debug.call(ctx, msg)
    if ( this.debug &&
         typeof this.debug !== 'function' &&
         typeof console !== 'undefined'
    ) console.log(msg)
  }

  HLP.extend = function (child, parent) {
    for (var key in parent) {
      if (Object.hasOwnProperty.call(parent, key))
        child[key] = parent[key]
    }
    function Ctor() { this.constructor = child }
    Ctor.prototype = parent.prototype
    child.prototype = new Ctor()
    child.__super__ = parent.prototype
  }

  // constant-time string comparison
  HLP.compare = function (str1, str2) {
    if (str1.length !== str2.length)
      return false
    var i = 0, result = 0
    for (; i < str1.length; i++)
      result |= str1[i].charCodeAt(0) ^ str2[i].charCodeAt(0)
    return result === 0
  }

  HLP.randomExponent = function () {
    return BigInt.randBigInt(1536)
  }

  HLP.smpHash = function (version, fmpi, smpi) {
    var sha256 = CryptoJS.algo.SHA256.create()
    sha256.update(CryptoJS.enc.Latin1.parse(HLP.packBytes(version, DTS.BYTE)))
    sha256.update(CryptoJS.enc.Latin1.parse(HLP.packMPI(fmpi)))
    if (smpi) sha256.update(CryptoJS.enc.Latin1.parse(HLP.packMPI(smpi)))
    var hash = sha256.finalize()
    return HLP.bits2bigInt(hash.toString(CryptoJS.enc.Latin1))
  }

  HLP.makeMac = function (aesctr, m) {
    var pass = CryptoJS.enc.Latin1.parse(m)
    var mac = CryptoJS.HmacSHA256(CryptoJS.enc.Latin1.parse(aesctr), pass)
    return HLP.mask(mac.toString(CryptoJS.enc.Latin1), 0, 160)
  }

  HLP.make1Mac = function (aesctr, m) {
    var pass = CryptoJS.enc.Latin1.parse(m)
    var mac = CryptoJS.HmacSHA1(CryptoJS.enc.Latin1.parse(aesctr), pass)
    return mac.toString(CryptoJS.enc.Latin1)
  }

  HLP.encryptAes = function (msg, c, iv) {
    var opts = {
        mode: CryptoJS.mode.CTR
      , iv: CryptoJS.enc.Latin1.parse(iv)
      , padding: CryptoJS.pad.NoPadding
    }
    var aesctr = CryptoJS.AES.encrypt(
        msg
      , CryptoJS.enc.Latin1.parse(c)
      , opts
    )
    var aesctr_decoded = CryptoJS.enc.Base64.parse(aesctr.toString())
    return CryptoJS.enc.Latin1.stringify(aesctr_decoded)
  }

  HLP.decryptAes = function (msg, c, iv) {
    msg = CryptoJS.enc.Latin1.parse(msg)
    var opts = {
        mode: CryptoJS.mode.CTR
      , iv: CryptoJS.enc.Latin1.parse(iv)
      , padding: CryptoJS.pad.NoPadding
    }
    return CryptoJS.AES.decrypt(
        CryptoJS.enc.Base64.stringify(msg)
      , CryptoJS.enc.Latin1.parse(c)
      , opts
    )
  }

  HLP.multPowMod = function (a, b, c, d, e) {
    return BigInt.multMod(BigInt.powMod(a, b, e), BigInt.powMod(c, d, e), e)
  }

  HLP.ZKP = function (v, c, d, e) {
    return BigInt.equals(c, HLP.smpHash(v, d, e))
  }

  // greater than, or equal
  HLP.GTOE = function (a, b) {
    return (BigInt.equals(a, b) || BigInt.greater(a, b))
  }

  HLP.between = function (x, a, b) {
    return (BigInt.greater(x, a) && BigInt.greater(b, x))
  }

  HLP.checkGroup = function (g, N_MINUS_2) {
    return HLP.GTOE(g, TWO) && HLP.GTOE(N_MINUS_2, g)
  }

  HLP.h1 = function (b, secbytes) {
    var sha1 = CryptoJS.algo.SHA1.create()
    sha1.update(CryptoJS.enc.Latin1.parse(b))
    sha1.update(CryptoJS.enc.Latin1.parse(secbytes))
    return (sha1.finalize()).toString(CryptoJS.enc.Latin1)
  }

  HLP.h2 = function (b, secbytes) {
    var sha256 = CryptoJS.algo.SHA256.create()
    sha256.update(CryptoJS.enc.Latin1.parse(b))
    sha256.update(CryptoJS.enc.Latin1.parse(secbytes))
    return (sha256.finalize()).toString(CryptoJS.enc.Latin1)
  }

  HLP.mask = function (bytes, start, n) {
    return bytes.substr(start / 8, n / 8)
  }

  var _toString = String.fromCharCode;
  HLP.packBytes = function (val, bytes) {
    val = val.toString(16)
    var nex, res = ''  // big-endian, unsigned long
    for (; bytes > 0; bytes--) {
      nex = val.length ? val.substr(-2, 2) : '0'
      val = val.substr(0, val.length - 2)
      res = _toString(parseInt(nex, 16)) + res
    }
    return res
  }

  HLP.packINT = function (d) {
    return HLP.packBytes(d, DTS.INT)
  }

  HLP.packCtr = function (d) {
    return HLP.padCtr(HLP.packBytes(d, DTS.CTR))
  }

  HLP.padCtr = function (ctr) {
    return ctr + '\x00\x00\x00\x00\x00\x00\x00\x00'
  }

  HLP.unpackCtr = function (d) {
    d = HLP.toByteArray(d.substring(0, 8))
    return HLP.unpack(d)
  }

  HLP.unpack = function (arr) {
    var val = 0, i = 0, len = arr.length
    for (; i < len; i++) {
      val = (val * 256) + arr[i]
    }
    return val
  }

  HLP.packData = function (d) {
    return HLP.packINT(d.length) + d
  }

  HLP.bits2bigInt = function (bits) {
    bits = HLP.toByteArray(bits)
    return BigInt.ba2bigInt(bits)
  }

  HLP.packMPI = function (mpi) {
    return HLP.packData(BigInt.bigInt2bits(BigInt.trim(mpi, 0)))
  }

  HLP.packSHORT = function (short) {
    return HLP.packBytes(short, DTS.SHORT)
  }

  HLP.unpackSHORT = function (short) {
    short = HLP.toByteArray(short)
    return HLP.unpack(short)
  }

  HLP.packTLV = function (type, value) {
    return HLP.packSHORT(type) + HLP.packSHORT(value.length) + value
  }

  HLP.readLen = function (msg) {
    msg = HLP.toByteArray(msg.substring(0, 4))
    return HLP.unpack(msg)
  }

  HLP.readData = function (data) {
    var n = HLP.unpack(data.splice(0, 4))
    return [n, data]
  }

  HLP.readMPI = function (data) {
    data = HLP.toByteArray(data)
    data = HLP.readData(data)
    return BigInt.ba2bigInt(data[1])
  }

  HLP.packMPIs = function (arr) {
    return arr.reduce(function (prv, cur) {
      return prv + HLP.packMPI(cur)
    }, '')
  }

  HLP.unpackMPIs = function (num, mpis) {
    var i = 0, arr = []
    for (; i < num; i++) arr.push('MPI')
    return (HLP.splitype(arr, mpis)).map(function (m) {
      return HLP.readMPI(m)
    })
  }

  HLP.wrapMsg = function (msg, fs, v3, our_it, their_it) {
    msg = CryptoJS.enc.Base64.stringify(CryptoJS.enc.Latin1.parse(msg))
    msg = WRAPPER_BEGIN + ":" + msg + WRAPPER_END

    var its
    if (v3) {
      its = '|'
      its += (HLP.readLen(our_it)).toString(16)
      its += '|'
      its += (HLP.readLen(their_it)).toString(16)
    }

    if (!fs) return [null, msg]

    var n = Math.ceil(msg.length / fs)
    if (n > 65535) return ['Too many fragments']
    if (n == 1) return [null, msg]

    var k, bi, ei, frag, mf, mfs = []
    for (k = 1; k <= n; k++) {
      bi = (k - 1) * fs
      ei = k * fs
      frag = msg.slice(bi, ei)
      mf = WRAPPER_BEGIN
      if (v3) mf += its
      mf += ',' + k + ','
      mf += n + ','
      mf += frag + ','
      mfs.push(mf)
    }

    return [null, mfs]
  }

  HLP.splitype = function splitype(arr, msg) {
    var data = []
    arr.forEach(function (a) {
      var str
      switch (a) {
        case 'PUBKEY':
          str = splitype(['SHORT', 'MPI', 'MPI', 'MPI', 'MPI'], msg).join('')
          break
        case 'DATA':  // falls through
        case 'MPI':
          str = msg.substring(0, HLP.readLen(msg) + 4)
          break
        default:
          str = msg.substring(0, DTS[a])
      }
      data.push(str)
      msg = msg.substring(str.length)
    })
    return data
  }

  // https://github.com/msgpack/msgpack-javascript/blob/master/msgpack.js

  var _bin2num = (function () {
    var i = 0, _bin2num = {}
    for (; i < 0x100; ++i) {
      _bin2num[String.fromCharCode(i)] = i  // "\00" -> 0x00
    }
    for (i = 0x80; i < 0x100; ++i) {  // [Webkit][Gecko]
      _bin2num[String.fromCharCode(0xf700 + i)] = i  // "\f780" -> 0x80
    }
    return _bin2num
  }())

  HLP.toByteArray = function (data) {
    var rv = []
      , ary = data.split("")
      , i = -1
      , iz = ary.length
      , remain = iz % 8

    while (remain--) {
      ++i
      rv[i] = _bin2num[ary[i]]
    }
    remain = iz >> 3
    while (remain--) {
      rv.push(_bin2num[ary[++i]], _bin2num[ary[++i]],
              _bin2num[ary[++i]], _bin2num[ary[++i]],
              _bin2num[ary[++i]], _bin2num[ary[++i]],
              _bin2num[ary[++i]], _bin2num[ary[++i]])
    }
    return rv
  }

}).call(this)
;(function () {
  "use strict";

  var root = this

  var CryptoJS, BigInt, Worker, WWPath, HLP
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = DSA
    CryptoJS = require('../vendor/crypto.js')
    BigInt = require('../vendor/bigint.js')
    WWPath = require('path').join(__dirname, '/dsa-webworker.js')
    HLP = require('./helpers.js')
  } else {
    // copy over and expose internals
    Object.keys(root.DSA).forEach(function (k) {
      DSA[k] = root.DSA[k]
    })
    root.DSA = DSA
    CryptoJS = root.CryptoJS
    BigInt = root.BigInt
    Worker = root.Worker
    WWPath = 'dsa-webworker.js'
    HLP = DSA.HLP
  }

  var ZERO = BigInt.str2bigInt('0', 10)
    , ONE = BigInt.str2bigInt('1', 10)
    , TWO = BigInt.str2bigInt('2', 10)
    , KEY_TYPE = '\x00\x00'

  var DEBUG = false
  function timer() {
    var start = (new Date()).getTime()
    return function (s) {
      if (!DEBUG || typeof console === 'undefined') return
      var t = (new Date()).getTime()
      console.log(s + ': ' + (t - start))
      start = t
    }
  }

  function makeRandom(min, max) {
    var c = BigInt.randBigInt(BigInt.bitSize(max))
    if (!HLP.between(c, min, max)) return makeRandom(min, max)
    return c
  }

  // altered BigInt.randProbPrime()
  // n rounds of Miller Rabin (after trial division with small primes)
  var rpprb = []
  function isProbPrime(k, n) {
    var i, B = 30000, l = BigInt.bitSize(k)
    var primes = BigInt.primes

    if (primes.length === 0)
      primes = BigInt.findPrimes(B)

    if (rpprb.length != k.length)
      rpprb = BigInt.dup(k)

    // check ans for divisibility by small primes up to B
    for (i = 0; (i < primes.length) && (primes[i] <= B); i++)
      if (BigInt.modInt(k, primes[i]) === 0 && !BigInt.equalsInt(k, primes[i]))
        return 0

    // do n rounds of Miller Rabin, with random bases less than k
    for (i = 0; i < n; i++) {
      BigInt.randBigInt_(rpprb, l, 0)
      while(!BigInt.greater(k, rpprb))  // pick a random rpprb that's < k
        BigInt.randBigInt_(rpprb, l, 0)
      if (!BigInt.millerRabin(k, rpprb))
        return 0
    }

    return 1
  }

  var bit_lengths = {
      '1024': { N: 160, repeat: 40 }  // 40x should give 2^-80 confidence
    , '2048': { N: 224, repeat: 56 }
  }

  var primes = {}

  // follows go lang http://golang.org/src/pkg/crypto/dsa/dsa.go
  // fips version was removed in 0c99af0df3e7
  function generatePrimes(bit_length) {

    var t = timer()  // for debugging

    // number of MR tests to perform
    var repeat = bit_lengths[bit_length].repeat

    var N = bit_lengths[bit_length].N

    var LM1 = BigInt.twoToThe(bit_length - 1)
    var bl4 = 4 * bit_length
    var brk = false

    var q, p, rem, counter
    for (;;) {

      q = BigInt.randBigInt(N, 1)
      q[0] |= 1

      if (!isProbPrime(q, repeat)) continue
      t('q')

      for (counter = 0; counter < bl4; counter++) {
        p = BigInt.randBigInt(bit_length, 1)
        p[0] |= 1

        rem = BigInt.mod(p, q)
        rem = BigInt.sub(rem, ONE)
        p = BigInt.sub(p, rem)

        if (BigInt.greater(LM1, p)) continue
        if (!isProbPrime(p, repeat)) continue

        t('p')
        primes[bit_length] = { p: p, q: q }
        brk = true
        break
      }

      if (brk) break
    }

    var h = BigInt.dup(TWO)
    var pm1 = BigInt.sub(p, ONE)
    var e = BigInt.multMod(pm1, BigInt.inverseMod(q, p), p)

    var g
    for (;;) {
      g = BigInt.powMod(h, e, p)
      if (BigInt.equals(g, ONE)) {
        h = BigInt.add(h, ONE)
        continue
      }
      primes[bit_length].g = g
      t('g')
      return
    }

    throw new Error('Unreachable!')
  }

  function DSA(obj, opts) {
    if (!(this instanceof DSA)) return new DSA(obj, opts)

    // options
    opts = opts || {}

    // inherit
    if (obj) {
      var self = this
      ;['p', 'q', 'g', 'y', 'x'].forEach(function (prop) {
        self[prop] = obj[prop]
      })
      this.type = obj.type || KEY_TYPE
      return
    }

    // default to 1024
    var bit_length = parseInt(opts.bit_length ? opts.bit_length : 1024, 10)

    if (!bit_lengths[bit_length])
      throw new Error('Unsupported bit length.')

    // set primes
    if (!primes[bit_length])
      generatePrimes(bit_length)

    this.p = primes[bit_length].p
    this.q = primes[bit_length].q
    this.g = primes[bit_length].g

    // key type
    this.type = KEY_TYPE

    // private key
    this.x = makeRandom(ZERO, this.q)

    // public keys (p, q, g, y)
    this.y = BigInt.powMod(this.g, this.x, this.p)

    // nocache?
    if (opts.nocache) primes[bit_length] = null
  }

  DSA.prototype = {

    constructor: DSA,

    packPublic: function () {
      var str = this.type
      str += HLP.packMPI(this.p)
      str += HLP.packMPI(this.q)
      str += HLP.packMPI(this.g)
      str += HLP.packMPI(this.y)
      return str
    },

    packPrivate: function () {
      var str = this.packPublic() + HLP.packMPI(this.x)
      str = CryptoJS.enc.Latin1.parse(str)
      return str.toString(CryptoJS.enc.Base64)
    },

    // http://www.imperialviolet.org/2013/06/15/suddendeathentropy.html
    generateNonce: function (m) {
      var priv = BigInt.bigInt2bits(BigInt.trim(this.x, 0))
      var rand = BigInt.bigInt2bits(BigInt.randBigInt(256))

      var sha256 = CryptoJS.algo.SHA256.create()
      sha256.update(CryptoJS.enc.Latin1.parse(priv))
      sha256.update(m)
      sha256.update(CryptoJS.enc.Latin1.parse(rand))

      var hash = sha256.finalize()
      hash = HLP.bits2bigInt(hash.toString(CryptoJS.enc.Latin1))
      BigInt.rightShift_(hash, 256 - BigInt.bitSize(this.q))

      return HLP.between(hash, ZERO, this.q) ? hash : this.generateNonce(m)
    },

    sign: function (m) {
      m = CryptoJS.enc.Latin1.parse(m)
      var b = BigInt.str2bigInt(m.toString(CryptoJS.enc.Hex), 16)
      var k, r = ZERO, s = ZERO
      while (BigInt.isZero(s) || BigInt.isZero(r)) {
        k = this.generateNonce(m)
        r = BigInt.mod(BigInt.powMod(this.g, k, this.p), this.q)
        if (BigInt.isZero(r)) continue
        s = BigInt.inverseMod(k, this.q)
        s = BigInt.mult(s, BigInt.add(b, BigInt.mult(this.x, r)))
        s = BigInt.mod(s, this.q)
      }
      return [r, s]
    },

    fingerprint: function () {
      var pk = this.packPublic()
      if (this.type === KEY_TYPE) pk = pk.substring(2)
      pk = CryptoJS.enc.Latin1.parse(pk)
      return CryptoJS.SHA1(pk).toString(CryptoJS.enc.Hex)
    }

  }

  DSA.parsePublic = function (str, priv) {
    var fields = ['SHORT', 'MPI', 'MPI', 'MPI', 'MPI']
    if (priv) fields.push('MPI')
    str = HLP.splitype(fields, str)
    var obj = {
        type: str[0]
      , p: HLP.readMPI(str[1])
      , q: HLP.readMPI(str[2])
      , g: HLP.readMPI(str[3])
      , y: HLP.readMPI(str[4])
    }
    if (priv) obj.x = HLP.readMPI(str[5])
    return new DSA(obj)
  }

  function tokenizeStr(str) {
    var start, end

    start = str.indexOf("(")
    end = str.lastIndexOf(")")

    if (start < 0 || end < 0)
      throw new Error("Malformed S-Expression")

    str = str.substring(start + 1, end)

    var splt = str.search(/\s/)
    var obj = {
        type: str.substring(0, splt)
      , val: []
    }

    str = str.substring(splt + 1, end)
    start = str.indexOf("(")

    if (start < 0) obj.val.push(str)
    else {

      var i, len, ss, es
      while (start > -1) {
        i = start + 1
        len = str.length
        for (ss = 1, es = 0; i < len && es < ss; i++) {
          if (str[i] === "(") ss++
          if (str[i] === ")") es++
        }
        obj.val.push(tokenizeStr(str.substring(start, ++i)))
        str = str.substring(++i)
        start = str.indexOf("(")
      }

    }
    return obj
  }

  function parseLibotr(obj) {
    if (!obj.type) throw new Error("Parse error.")

    var o, val
    if (obj.type === "privkeys") {
      o = []
      obj.val.forEach(function (i) {
        o.push(parseLibotr(i))
      })
      return o
    }

    o = {}
    obj.val.forEach(function (i) {

      val = i.val[0]
      if (typeof val === "string") {

        if (val.indexOf("#") === 0) {
          val = val.substring(1, val.lastIndexOf("#"))
          val = BigInt.str2bigInt(val, 16)
        }

      } else {
        val = parseLibotr(i)
      }

      o[i.type] = val
    })

    return o
  }

  DSA.parsePrivate = function (str, libotr) {
    if (!libotr) {
      str = CryptoJS.enc.Base64.parse(str)
      str = str.toString(CryptoJS.enc.Latin1)
      return DSA.parsePublic(str, true)
    }
    // only returning the first key found
    return parseLibotr(tokenizeStr(str))[0]["private-key"].dsa
  }

  DSA.verify = function (key, m, r, s) {
    if (!HLP.between(r, ZERO, key.q) || !HLP.between(s, ZERO, key.q))
      return false

    var hm = CryptoJS.enc.Latin1.parse(m)  // CryptoJS.SHA1(m)
    hm = BigInt.str2bigInt(hm.toString(CryptoJS.enc.Hex), 16)

    var w = BigInt.inverseMod(s, key.q)
    var u1 = BigInt.multMod(hm, w, key.q)
    var u2 = BigInt.multMod(r, w, key.q)

    u1 = BigInt.powMod(key.g, u1, key.p)
    u2 = BigInt.powMod(key.y, u2, key.p)

    var v = BigInt.mod(BigInt.multMod(u1, u2, key.p), key.q)

    return BigInt.equals(v, r)
  }

  DSA.createInWebWorker = function (options, cb) {
    var opts = {
        path: WWPath
      , seed: BigInt.getSeed
    }
    if (options && typeof options === 'object')
      Object.keys(options).forEach(function (k) {
        opts[k] = options[k]
      })

    // load optional dep. in node
    if (typeof module !== 'undefined' && module.exports)
      Worker = require('webworker-threads').Worker

    var worker = new Worker(opts.path)
    worker.onmessage = function (e) {
      var data = e.data
      switch (data.type) {
        case "debug":
          if (!DEBUG || typeof console === 'undefined') return
          console.log(data.val)
          break;
        case "data":
          worker.terminate()
          cb(DSA.parsePrivate(data.val))
          break;
        default:
          throw new Error("Unrecognized type.")
      }
    }
    worker.postMessage({
        seed: opts.seed()
      , imports: opts.imports
      , debug: DEBUG
    })
  }

}).call(this)
;(function () {
  "use strict";

  var root = this

  var Parse = {}, CryptoJS, CONST, HLP
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Parse
    CryptoJS = require('../vendor/crypto.js')
    CONST = require('./const.js')
    HLP = require('./helpers.js')
  } else {
    root.OTR.Parse = Parse
    CryptoJS = root.CryptoJS
    CONST = root.OTR.CONST
    HLP = root.OTR.HLP
  }

  // whitespace tags
  var tags = {}
  tags[CONST.WHITESPACE_TAG_V2] = CONST.OTR_VERSION_2
  tags[CONST.WHITESPACE_TAG_V3] = CONST.OTR_VERSION_3

  Parse.parseMsg = function (otr, msg) {

    var ver = []

    // is this otr?
    var start = msg.indexOf(CONST.OTR_TAG)
    if (!~start) {

      // restart fragments
      this.initFragment(otr)

      // whitespace tags
      ind = msg.indexOf(CONST.WHITESPACE_TAG)

      if (~ind) {

        msg = msg.split('')
        msg.splice(ind, 16)

        var tag, len = msg.length
        for (; ind < len;) {
          tag = msg.slice(ind, ind + 8).join('')
          if (Object.hasOwnProperty.call(tags, tag)) {
            msg.splice(ind, 8)
            ver.push(tags[tag])
            continue
          }
          ind += 8
        }

        msg = msg.join('')

      }

      return { msg: msg, ver: ver }
    }

    var ind = start + CONST.OTR_TAG.length
    var com = msg[ind]

    // message fragment
    if (com === ',' || com === '|') {
      return this.msgFragment(otr, msg.substring(ind + 1), (com === '|'))
    }

    this.initFragment(otr)

    // query message
    if (~['?', 'v'].indexOf(com)) {

      // version 1
      if (msg[ind] === '?') {
        ver.push(CONST.OTR_VERSION_1)
        ind += 1
      }

      // other versions
      var vers = {
          '2': CONST.OTR_VERSION_2
        , '3': CONST.OTR_VERSION_3
      }
      var qs = msg.substring(ind + 1)
      var qi = qs.indexOf('?')

      if (qi >= 1) {
        qs = qs.substring(0, qi).split('')
        if (msg[ind] === 'v') {
          qs.forEach(function (q) {
            if (Object.hasOwnProperty.call(vers, q)) ver.push(vers[q])
          })
        }
      }

      return { cls: 'query', ver: ver }
    }

    // otr message
    if (com === ':') {

      ind += 1

      var info = msg.substring(ind, ind + 4)
      if (info.length < 4) return { msg: msg }
      info = CryptoJS.enc.Base64.parse(info).toString(CryptoJS.enc.Latin1)

      var version = info.substring(0, 2)
      var type = info.substring(2)

      // supporting otr versions 2 and 3
      if (!otr['ALLOW_V' + HLP.unpackSHORT(version)]) return { msg: msg }

      ind += 4

      var end = msg.substring(ind).indexOf('.')
      if (!~end) return { msg: msg }

      msg = CryptoJS.enc.Base64.parse(msg.substring(ind, ind + end))
      msg = CryptoJS.enc.Latin1.stringify(msg)

      // instance tags
      var instance_tags
      if (version === CONST.OTR_VERSION_3) {
        instance_tags = msg.substring(0, 8)
        msg = msg.substring(8)
      }

      var cls
      if (~['\x02', '\x0a', '\x11', '\x12'].indexOf(type)) {
        cls = 'ake'
      } else if (type === '\x03') {
        cls = 'data'
      }

      return {
          version: version
        , type: type
        , msg: msg
        , cls: cls
        , instance_tags: instance_tags
      }
    }

    // error message
    if (msg.substring(ind, ind + 7) === ' Error:') {
      if (otr.ERROR_START_AKE) {
        otr.sendQueryMsg()
      }
      return { msg: msg.substring(ind + 7), cls: 'error' }
    }

    return { msg: msg }
  }

  Parse.initFragment = function (otr) {
    otr.fragment = { s: '', j: 0, k: 0 }
  }

  Parse.msgFragment = function (otr, msg, v3) {

    msg = msg.split(',')

    // instance tags
    if (v3) {
      var its = msg.shift().split('|')
      var their_it = HLP.packINT(parseInt(its[0], 16))
      var our_it = HLP.packINT(parseInt(its[1], 16))
      if (otr.checkInstanceTags(their_it + our_it)) return  // ignore
    }

    if (msg.length < 4 ||
      isNaN(parseInt(msg[0], 10)) ||
      isNaN(parseInt(msg[1], 10))
    ) return

    var k = parseInt(msg[0], 10)
    var n = parseInt(msg[1], 10)
    msg = msg[2]

    if (n < k || n === 0 || k === 0) {
      this.initFragment(otr)
      return
    }

    if (k === 1) {
      this.initFragment(otr)
      otr.fragment = { k: 1, n: n, s: msg }
    } else if (n === otr.fragment.n && k === (otr.fragment.k + 1)) {
      otr.fragment.s += msg
      otr.fragment.k += 1
    } else {
      this.initFragment(otr)
    }

    if (n === k) {
      msg = otr.fragment.s
      this.initFragment(otr)
      return this.parseMsg(otr, msg)
    }

    return
  }

}).call(this)
;(function () {
  "use strict";

  var root = this

  var CryptoJS, BigInt, CONST, HLP, DSA
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = AKE
    CryptoJS = require('../vendor/crypto.js')
    BigInt = require('../vendor/bigint.js')
    CONST = require('./const.js')
    HLP = require('./helpers.js')
    DSA = require('./dsa.js')
  } else {
    root.OTR.AKE = AKE
    CryptoJS = root.CryptoJS
    BigInt = root.BigInt
    CONST = root.OTR.CONST
    HLP = root.OTR.HLP
    DSA = root.DSA
  }

  // diffie-hellman modulus
  // see group 5, RFC 3526
  var N = BigInt.str2bigInt(CONST.N, 16)
  var N_MINUS_2 = BigInt.sub(N, BigInt.str2bigInt('2', 10))

  function hMac(gx, gy, pk, kid, m) {
    var pass = CryptoJS.enc.Latin1.parse(m)
    var hmac = CryptoJS.algo.HMAC.create(CryptoJS.algo.SHA256, pass)
    hmac.update(CryptoJS.enc.Latin1.parse(HLP.packMPI(gx)))
    hmac.update(CryptoJS.enc.Latin1.parse(HLP.packMPI(gy)))
    hmac.update(CryptoJS.enc.Latin1.parse(pk))
    hmac.update(CryptoJS.enc.Latin1.parse(kid))
    return (hmac.finalize()).toString(CryptoJS.enc.Latin1)
  }

  // AKE constructor
  function AKE(otr) {
    if (!(this instanceof AKE)) return new AKE(otr)

    // otr instance
    this.otr = otr

    // our keys
    this.our_dh = otr.our_old_dh
    this.our_keyid = otr.our_keyid - 1

    // their keys
    this.their_y = null
    this.their_keyid = null
    this.their_priv_pk = null

    // state
    this.ssid = null
    this.transmittedRS = false
    this.r = null

    // bind methods
    var self = this
    ;['sendMsg'].forEach(function (meth) {
      self[meth] = self[meth].bind(self)
    })
  }

  AKE.prototype = {

    constructor: AKE,

    createKeys: function(g) {
      var s = BigInt.powMod(g, this.our_dh.privateKey, N)
      var secbytes = HLP.packMPI(s)
      this.ssid = HLP.mask(HLP.h2('\x00', secbytes), 0, 64)  // first 64-bits
      var tmp = HLP.h2('\x01', secbytes)
      this.c = HLP.mask(tmp, 0, 128)  // first 128-bits
      this.c_prime = HLP.mask(tmp, 128, 128)  // second 128-bits
      this.m1 = HLP.h2('\x02', secbytes)
      this.m2 = HLP.h2('\x03', secbytes)
      this.m1_prime = HLP.h2('\x04', secbytes)
      this.m2_prime = HLP.h2('\x05', secbytes)
    },

    verifySignMac: function (mac, aesctr, m2, c, their_y, our_dh_pk, m1, ctr) {
      // verify mac
      var vmac = HLP.makeMac(aesctr, m2)
      if (!HLP.compare(mac, vmac))
        return ['MACs do not match.']

      // decrypt x
      var x = HLP.decryptAes(aesctr.substring(4), c, ctr)
      x = HLP.splitype(['PUBKEY', 'INT', 'SIG'], x.toString(CryptoJS.enc.Latin1))

      var m = hMac(their_y, our_dh_pk, x[0], x[1], m1)
      var pub = DSA.parsePublic(x[0])

      var r = HLP.bits2bigInt(x[2].substring(0, 20))
      var s = HLP.bits2bigInt(x[2].substring(20))

      // verify sign m
      if (!DSA.verify(pub, m, r, s)) return ['Cannot verify signature of m.']

      return [null, HLP.readLen(x[1]), pub]
    },

    makeM: function (their_y, m1, c, m2) {
      var pk = this.otr.priv.packPublic()
      var kid = HLP.packINT(this.our_keyid)
      var m = hMac(this.our_dh.publicKey, their_y, pk, kid, m1)
      m = this.otr.priv.sign(m)
      var msg = pk + kid
      msg += BigInt.bigInt2bits(m[0], 20)  // pad to 20 bytes
      msg += BigInt.bigInt2bits(m[1], 20)
      msg = CryptoJS.enc.Latin1.parse(msg)
      var aesctr = HLP.packData(HLP.encryptAes(msg, c, HLP.packCtr(0)))
      var mac = HLP.makeMac(aesctr, m2)
      return aesctr + mac
    },

    akeSuccess: function (version) {
      HLP.debug.call(this.otr, 'success')

      if (BigInt.equals(this.their_y, this.our_dh.publicKey))
        return this.otr.error('equal keys - we have a problem.', true)

      this.otr.our_old_dh = this.our_dh
      this.otr.their_priv_pk = this.their_priv_pk

      if (!(
        (this.their_keyid === this.otr.their_keyid &&
         BigInt.equals(this.their_y, this.otr.their_y)) ||
        (this.their_keyid === (this.otr.their_keyid - 1) &&
         BigInt.equals(this.their_y, this.otr.their_old_y))
      )) {

        this.otr.their_y = this.their_y
        this.otr.their_old_y = null
        this.otr.their_keyid = this.their_keyid

        // rotate keys
        this.otr.sessKeys[0] = [ new this.otr.DHSession(
            this.otr.our_dh
          , this.otr.their_y
        ), null ]
        this.otr.sessKeys[1] = [ new this.otr.DHSession(
            this.otr.our_old_dh
          , this.otr.their_y
        ), null ]

      }

      // ake info
      this.otr.ssid = this.ssid
      this.otr.transmittedRS = this.transmittedRS
      this.otr_version = version

      // go encrypted
      this.otr.authstate = CONST.AUTHSTATE_NONE
      this.otr.msgstate = CONST.MSGSTATE_ENCRYPTED

      // null out values
      this.r = null
      this.myhashed = null
      this.dhcommit = null
      this.encrypted = null
      this.hashed = null

      this.otr.trigger('status', [CONST.STATUS_AKE_SUCCESS])

      // send stored msgs
      this.otr.sendStored()
    },

    handleAKE: function (msg) {
      var send, vsm, type
      var version = msg.version

      switch (msg.type) {

        case '\x02':
          HLP.debug.call(this.otr, 'd-h key message')

          msg = HLP.splitype(['DATA', 'DATA'], msg.msg)

          if (this.otr.authstate === CONST.AUTHSTATE_AWAITING_DHKEY) {
            var ourHash = HLP.readMPI(this.myhashed)
            var theirHash = HLP.readMPI(msg[1])
            if (BigInt.greater(ourHash, theirHash)) {
              type = '\x02'
              send = this.dhcommit
              break  // ignore
            } else {
              // forget
              this.our_dh = this.otr.dh()
              this.otr.authstate = CONST.AUTHSTATE_NONE
              this.r = null
              this.myhashed = null
            }
          } else if (
            this.otr.authstate === CONST.AUTHSTATE_AWAITING_SIG
          ) this.our_dh = this.otr.dh()

          this.otr.authstate = CONST.AUTHSTATE_AWAITING_REVEALSIG

          this.encrypted = msg[0].substring(4)
          this.hashed = msg[1].substring(4)

          type = '\x0a'
          send = HLP.packMPI(this.our_dh.publicKey)
          break

        case '\x0a':
          HLP.debug.call(this.otr, 'reveal signature message')

          msg = HLP.splitype(['MPI'], msg.msg)

          if (this.otr.authstate !== CONST.AUTHSTATE_AWAITING_DHKEY) {
            if (this.otr.authstate === CONST.AUTHSTATE_AWAITING_SIG) {
              if (!BigInt.equals(this.their_y, HLP.readMPI(msg[0]))) return
            } else {
              return  // ignore
            }
          }

          this.otr.authstate = CONST.AUTHSTATE_AWAITING_SIG

          this.their_y = HLP.readMPI(msg[0])

          // verify gy is legal 2 <= gy <= N-2
          if (!HLP.checkGroup(this.their_y, N_MINUS_2))
            return this.otr.error('Illegal g^y.', true)

          this.createKeys(this.their_y)

          type = '\x11'
          send = HLP.packMPI(this.r)
          send += this.makeM(this.their_y, this.m1, this.c, this.m2)

          this.m1 = null
          this.m2 = null
          this.c = null
          break

        case '\x11':
          HLP.debug.call(this.otr, 'signature message')

          if (this.otr.authstate !== CONST.AUTHSTATE_AWAITING_REVEALSIG)
            return  // ignore

          msg = HLP.splitype(['DATA', 'DATA', 'MAC'], msg.msg)

          this.r = HLP.readMPI(msg[0])

          // decrypt their_y
          var key = CryptoJS.enc.Hex.parse(BigInt.bigInt2str(this.r, 16))
          key = CryptoJS.enc.Latin1.stringify(key)

          var gxmpi = HLP.decryptAes(this.encrypted, key, HLP.packCtr(0))
          gxmpi = gxmpi.toString(CryptoJS.enc.Latin1)

          this.their_y = HLP.readMPI(gxmpi)

          // verify hash
          var hash = CryptoJS.SHA256(CryptoJS.enc.Latin1.parse(gxmpi))

          if (!HLP.compare(this.hashed, hash.toString(CryptoJS.enc.Latin1)))
            return this.otr.error('Hashed g^x does not match.', true)

          // verify gx is legal 2 <= g^x <= N-2
          if (!HLP.checkGroup(this.their_y, N_MINUS_2))
            return this.otr.error('Illegal g^x.', true)

          this.createKeys(this.their_y)

          vsm = this.verifySignMac(
              msg[2]
            , msg[1]
            , this.m2
            , this.c
            , this.their_y
            , this.our_dh.publicKey
            , this.m1
            , HLP.packCtr(0)
          )
          if (vsm[0]) return this.otr.error(vsm[0], true)

          // store their key
          this.their_keyid = vsm[1]
          this.their_priv_pk = vsm[2]

          send = this.makeM(
              this.their_y
            , this.m1_prime
            , this.c_prime
            , this.m2_prime
          )

          this.m1 = null
          this.m2 = null
          this.m1_prime = null
          this.m2_prime = null
          this.c = null
          this.c_prime = null

          this.sendMsg(version, '\x12', send)
          this.akeSuccess(version)
          return

        case '\x12':
          HLP.debug.call(this.otr, 'data message')

          if (this.otr.authstate !== CONST.AUTHSTATE_AWAITING_SIG)
            return  // ignore

          msg = HLP.splitype(['DATA', 'MAC'], msg.msg)

          vsm = this.verifySignMac(
              msg[1]
            , msg[0]
            , this.m2_prime
            , this.c_prime
            , this.their_y
            , this.our_dh.publicKey
            , this.m1_prime
            , HLP.packCtr(0)
          )
          if (vsm[0]) return this.otr.error(vsm[0], true)

          // store their key
          this.their_keyid = vsm[1]
          this.their_priv_pk = vsm[2]

          this.m1_prime = null
          this.m2_prime = null
          this.c_prime = null

          this.transmittedRS = true
          this.akeSuccess(version)
          return

        default:
          return  // ignore

      }

      this.sendMsg(version, type, send)
    },

    sendMsg: function (version, type, msg) {
      var send = version + type
      var v3 = (version === CONST.OTR_VERSION_3)

      // instance tags for v3
      if (v3) {
        HLP.debug.call(this.otr, 'instance tags')
        send += this.otr.our_instance_tag
        send += this.otr.their_instance_tag
      }

      send += msg

      // fragment message if necessary
      send = HLP.wrapMsg(
          send
        , this.otr.fragment_size
        , v3
        , this.otr.our_instance_tag
        , this.otr.their_instance_tag
      )
      if (send[0]) return this.otr.error(send[0])

      this.otr.io(send[1])
    },

    initiateAKE: function (version) {
      HLP.debug.call(this.otr, 'd-h commit message')

      this.otr.trigger('status', [CONST.STATUS_AKE_INIT])

      this.otr.authstate = CONST.AUTHSTATE_AWAITING_DHKEY

      var gxmpi = HLP.packMPI(this.our_dh.publicKey)
      gxmpi = CryptoJS.enc.Latin1.parse(gxmpi)

      this.r = BigInt.randBigInt(128)
      var key = CryptoJS.enc.Hex.parse(BigInt.bigInt2str(this.r, 16))
      key = CryptoJS.enc.Latin1.stringify(key)

      this.myhashed = CryptoJS.SHA256(gxmpi)
      this.myhashed = HLP.packData(this.myhashed.toString(CryptoJS.enc.Latin1))

      this.dhcommit = HLP.packData(HLP.encryptAes(gxmpi, key, HLP.packCtr(0)))
      this.dhcommit += this.myhashed

      this.sendMsg(version, '\x02', this.dhcommit)
    }

  }

}).call(this)
;(function () {
  "use strict";

  var root = this

  var CryptoJS, BigInt,  EventEmitter, CONST, HLP
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = SM
    CryptoJS = require('../vendor/crypto.js')
    BigInt = require('../vendor/bigint.js')
    EventEmitter = require('../vendor/eventemitter.js')
    CONST = require('./const.js')
    HLP = require('./helpers.js')
  } else {
    root.OTR.SM = SM
    CryptoJS = root.CryptoJS
    BigInt = root.BigInt
    EventEmitter = root.EventEmitter
    CONST = root.OTR.CONST
    HLP = root.OTR.HLP
  }

  // diffie-hellman modulus and generator
  // see group 5, RFC 3526
  var G = BigInt.str2bigInt(CONST.G, 10)
  var N = BigInt.str2bigInt(CONST.N, 16)
  var N_MINUS_2 = BigInt.sub(N, BigInt.str2bigInt('2', 10))

  // to calculate D's for zero-knowledge proofs
  var Q = BigInt.sub(N, BigInt.str2bigInt('1', 10))
  BigInt.divInt_(Q, 2)  // meh

  function SM(reqs) {
    if (!(this instanceof SM)) return new SM(reqs)

    this.version = 1

    this.our_fp = reqs.our_fp
    this.their_fp = reqs.their_fp
    this.ssid = reqs.ssid

    this.debug = !!reqs.debug

    // initial state
    this.init()
  }

  // inherit from EE
  HLP.extend(SM, EventEmitter)

  // set the initial values
  // also used when aborting
  SM.prototype.init = function () {
    this.smpstate = CONST.SMPSTATE_EXPECT1
    this.secret = null
  }

  SM.prototype.makeSecret = function (our, secret) {
    var sha256 = CryptoJS.algo.SHA256.create()
    sha256.update(CryptoJS.enc.Latin1.parse(HLP.packBytes(this.version, 1)))
    sha256.update(CryptoJS.enc.Hex.parse(our ? this.our_fp : this.their_fp))
    sha256.update(CryptoJS.enc.Hex.parse(our ? this.their_fp : this.our_fp))
    sha256.update(CryptoJS.enc.Latin1.parse(this.ssid))
    sha256.update(CryptoJS.enc.Latin1.parse(secret))
    var hash = sha256.finalize()
    this.secret = HLP.bits2bigInt(hash.toString(CryptoJS.enc.Latin1))
  }

  SM.prototype.makeG2s = function () {
    this.a2 = HLP.randomExponent()
    this.a3 = HLP.randomExponent()
    this.g2a = BigInt.powMod(G, this.a2, N)
    this.g3a = BigInt.powMod(G, this.a3, N)
    if ( !HLP.checkGroup(this.g2a, N_MINUS_2) ||
         !HLP.checkGroup(this.g3a, N_MINUS_2)
    ) this.makeG2s()
  }

  SM.prototype.computeGs = function (g2a, g3a) {
    this.g2 = BigInt.powMod(g2a, this.a2, N)
    this.g3 = BigInt.powMod(g3a, this.a3, N)
  }

  SM.prototype.computePQ = function (r) {
    this.p = BigInt.powMod(this.g3, r, N)
    this.q = HLP.multPowMod(G, r, this.g2, this.secret, N)
  }

  SM.prototype.computeR = function () {
    this.r = BigInt.powMod(this.QoQ, this.a3, N)
  }

  SM.prototype.computeRab = function (r) {
    return BigInt.powMod(r, this.a3, N)
  }

  SM.prototype.computeC = function (v, r) {
    return HLP.smpHash(v, BigInt.powMod(G, r, N))
  }

  SM.prototype.computeD = function (r, a, c) {
    return BigInt.subMod(r, BigInt.multMod(a, c, Q), Q)
  }

  // the bulk of the work
  SM.prototype.handleSM = function (msg) {
    var send, r2, r3, r7, t1, t2, t3, t4, rab, tmp2, cR, d7, ms, trust

    var expectStates = {
        2: CONST.SMPSTATE_EXPECT1
      , 3: CONST.SMPSTATE_EXPECT2
      , 4: CONST.SMPSTATE_EXPECT3
      , 5: CONST.SMPSTATE_EXPECT4
      , 7: CONST.SMPSTATE_EXPECT1
    }

    if (msg.type === 6) {
      this.init()
      this.trigger('abort')
      return
    }

    // abort! there was an error
    if (this.smpstate !== expectStates[msg.type])
      return this.abort()

    switch (this.smpstate) {

      case CONST.SMPSTATE_EXPECT1:
        HLP.debug.call(this, 'smp tlv 2')

        // user specified question
        var ind, question
        if (msg.type === 7) {
          ind = msg.msg.indexOf('\x00')
          question = msg.msg.substring(0, ind)
          msg.msg = msg.msg.substring(ind + 1)
        }

        // 0:g2a, 1:c2, 2:d2, 3:g3a, 4:c3, 5:d3
        ms = HLP.readLen(msg.msg.substr(0, 4))
        if (ms !== 6) return this.abort()
        msg = HLP.unpackMPIs(6, msg.msg.substring(4))

        if ( !HLP.checkGroup(msg[0], N_MINUS_2) ||
             !HLP.checkGroup(msg[3], N_MINUS_2)
        ) return this.abort()

        // verify znp's
        if (!HLP.ZKP(1, msg[1], HLP.multPowMod(G, msg[2], msg[0], msg[1], N)))
          return this.abort()

        if (!HLP.ZKP(2, msg[4], HLP.multPowMod(G, msg[5], msg[3], msg[4], N)))
          return this.abort()

        this.g3ao = msg[3]  // save for later

        this.makeG2s()

        // zero-knowledge proof that the exponents
        // associated with g2a & g3a are known
        r2 = HLP.randomExponent()
        r3 = HLP.randomExponent()
        this.c2 = this.computeC(3, r2)
        this.c3 = this.computeC(4, r3)
        this.d2 = this.computeD(r2, this.a2, this.c2)
        this.d3 = this.computeD(r3, this.a3, this.c3)

        this.computeGs(msg[0], msg[3])

        this.smpstate = CONST.SMPSTATE_EXPECT0

        // assume utf8 question
        question = CryptoJS.enc.Latin1
          .parse(question)
          .toString(CryptoJS.enc.Utf8)

        // invoke question
        this.trigger('question', [question])
        return

      case CONST.SMPSTATE_EXPECT2:
        HLP.debug.call(this, 'smp tlv 3')

        // 0:g2a, 1:c2, 2:d2, 3:g3a, 4:c3, 5:d3, 6:p, 7:q, 8:cP, 9:d5, 10:d6
        ms = HLP.readLen(msg.msg.substr(0, 4))
        if (ms !== 11) return this.abort()
        msg = HLP.unpackMPIs(11, msg.msg.substring(4))

        if ( !HLP.checkGroup(msg[0], N_MINUS_2) ||
             !HLP.checkGroup(msg[3], N_MINUS_2) ||
             !HLP.checkGroup(msg[6], N_MINUS_2) ||
             !HLP.checkGroup(msg[7], N_MINUS_2)
        ) return this.abort()

        // verify znp of c3 / c3
        if (!HLP.ZKP(3, msg[1], HLP.multPowMod(G, msg[2], msg[0], msg[1], N)))
          return this.abort()

        if (!HLP.ZKP(4, msg[4], HLP.multPowMod(G, msg[5], msg[3], msg[4], N)))
          return this.abort()

        this.g3ao = msg[3]  // save for later

        this.computeGs(msg[0], msg[3])

        // verify znp of cP
        t1 = HLP.multPowMod(this.g3, msg[9], msg[6], msg[8], N)
        t2 = HLP.multPowMod(G, msg[9], this.g2, msg[10], N)
        t2 = BigInt.multMod(t2, BigInt.powMod(msg[7], msg[8], N), N)

        if (!HLP.ZKP(5, msg[8], t1, t2))
          return this.abort()

        var r4 = HLP.randomExponent()
        this.computePQ(r4)

        // zero-knowledge proof that P & Q
        // were generated according to the protocol
        var r5 = HLP.randomExponent()
        var r6 = HLP.randomExponent()
        var tmp = HLP.multPowMod(G, r5, this.g2, r6, N)
        var cP = HLP.smpHash(6, BigInt.powMod(this.g3, r5, N), tmp)
        var d5 = this.computeD(r5, r4, cP)
        var d6 = this.computeD(r6, this.secret, cP)

        // store these
        this.QoQ = BigInt.divMod(this.q, msg[7], N)
        this.PoP = BigInt.divMod(this.p, msg[6], N)

        this.computeR()

        // zero-knowledge proof that R
        // was generated according to the protocol
        r7 = HLP.randomExponent()
        tmp2 = BigInt.powMod(this.QoQ, r7, N)
        cR = HLP.smpHash(7, BigInt.powMod(G, r7, N), tmp2)
        d7 = this.computeD(r7, this.a3, cR)

        this.smpstate = CONST.SMPSTATE_EXPECT4

        send = HLP.packINT(8) + HLP.packMPIs([
            this.p
          , this.q
          , cP
          , d5
          , d6
          , this.r
          , cR
          , d7
        ])

        // TLV
        send = HLP.packTLV(4, send)
        break

      case CONST.SMPSTATE_EXPECT3:
        HLP.debug.call(this, 'smp tlv 4')

        // 0:p, 1:q, 2:cP, 3:d5, 4:d6, 5:r, 6:cR, 7:d7
        ms = HLP.readLen(msg.msg.substr(0, 4))
        if (ms !== 8) return this.abort()
        msg = HLP.unpackMPIs(8, msg.msg.substring(4))

        if ( !HLP.checkGroup(msg[0], N_MINUS_2) ||
             !HLP.checkGroup(msg[1], N_MINUS_2) ||
             !HLP.checkGroup(msg[5], N_MINUS_2)
        ) return this.abort()

        // verify znp of cP
        t1 = HLP.multPowMod(this.g3, msg[3], msg[0], msg[2], N)
        t2 = HLP.multPowMod(G, msg[3], this.g2, msg[4], N)
        t2 = BigInt.multMod(t2, BigInt.powMod(msg[1], msg[2], N), N)

        if (!HLP.ZKP(6, msg[2], t1, t2))
          return this.abort()

        // verify znp of cR
        t3 = HLP.multPowMod(G, msg[7], this.g3ao, msg[6], N)
        this.QoQ = BigInt.divMod(msg[1], this.q, N)  // save Q over Q
        t4 = HLP.multPowMod(this.QoQ, msg[7], msg[5], msg[6], N)

        if (!HLP.ZKP(7, msg[6], t3, t4))
          return this.abort()

        this.computeR()

        // zero-knowledge proof that R
        // was generated according to the protocol
        r7 = HLP.randomExponent()
        tmp2 = BigInt.powMod(this.QoQ, r7, N)
        cR = HLP.smpHash(8, BigInt.powMod(G, r7, N), tmp2)
        d7 = this.computeD(r7, this.a3, cR)

        send = HLP.packINT(3) + HLP.packMPIs([ this.r, cR, d7 ])
        send = HLP.packTLV(5, send)

        rab = this.computeRab(msg[5])
        trust = !!BigInt.equals(rab, BigInt.divMod(msg[0], this.p, N))

        this.trigger('trust', [trust, 'answered'])
        this.init()
        break

      case CONST.SMPSTATE_EXPECT4:
        HLP.debug.call(this, 'smp tlv 5')

        // 0:r, 1:cR, 2:d7
        ms = HLP.readLen(msg.msg.substr(0, 4))
        if (ms !== 3) return this.abort()
        msg = HLP.unpackMPIs(3, msg.msg.substring(4))

        if (!HLP.checkGroup(msg[0], N_MINUS_2)) return this.abort()

        // verify znp of cR
        t3 = HLP.multPowMod(G, msg[2], this.g3ao, msg[1], N)
        t4 = HLP.multPowMod(this.QoQ, msg[2], msg[0], msg[1], N)
        if (!HLP.ZKP(8, msg[1], t3, t4))
          return this.abort()

        rab = this.computeRab(msg[0])
        trust = !!BigInt.equals(rab, this.PoP)

        this.trigger('trust', [trust, 'asked'])
        this.init()
        return

    }

    this.sendMsg(send)
  }

  // send a message
  SM.prototype.sendMsg = function (send) {
    this.trigger('send', [this.ssid, '\x00' + send])
  }

  SM.prototype.rcvSecret = function (secret, question) {
    HLP.debug.call(this, 'receive secret')

    var fn, our = false
    if (this.smpstate === CONST.SMPSTATE_EXPECT0) {
      fn = this.answer
    } else {
      fn = this.initiate
      our = true
    }

    this.makeSecret(our, secret)
    fn.call(this, question)
  }

  SM.prototype.answer = function () {
    HLP.debug.call(this, 'smp answer')

    var r4 = HLP.randomExponent()
    this.computePQ(r4)

    // zero-knowledge proof that P & Q
    // were generated according to the protocol
    var r5 = HLP.randomExponent()
    var r6 = HLP.randomExponent()
    var tmp = HLP.multPowMod(G, r5, this.g2, r6, N)
    var cP = HLP.smpHash(5, BigInt.powMod(this.g3, r5, N), tmp)
    var d5 = this.computeD(r5, r4, cP)
    var d6 = this.computeD(r6, this.secret, cP)

    this.smpstate = CONST.SMPSTATE_EXPECT3

    var send = HLP.packINT(11) + HLP.packMPIs([
        this.g2a
      , this.c2
      , this.d2
      , this.g3a
      , this.c3
      , this.d3
      , this.p
      , this.q
      , cP
      , d5
      , d6
    ])

    this.sendMsg(HLP.packTLV(3, send))
  }

  SM.prototype.initiate = function (question) {
    HLP.debug.call(this, 'smp initiate')

    if (this.smpstate !== CONST.SMPSTATE_EXPECT1)
      this.abort()  // abort + restart

    this.makeG2s()

    // zero-knowledge proof that the exponents
    // associated with g2a & g3a are known
    var r2 = HLP.randomExponent()
    var r3 = HLP.randomExponent()
    this.c2 = this.computeC(1, r2)
    this.c3 = this.computeC(2, r3)
    this.d2 = this.computeD(r2, this.a2, this.c2)
    this.d3 = this.computeD(r3, this.a3, this.c3)

    // set the next expected state
    this.smpstate = CONST.SMPSTATE_EXPECT2

    var send = ''
    var type = 2

    if (question) {
      send += question
      send += '\x00'
      type = 7
    }

    send += HLP.packINT(6) + HLP.packMPIs([
        this.g2a
      , this.c2
      , this.d2
      , this.g3a
      , this.c3
      , this.d3
    ])

    this.sendMsg(HLP.packTLV(type, send))
  }

  SM.prototype.abort = function () {
    this.init()
    this.sendMsg(HLP.packTLV(6, ''))
    this.trigger('abort')
  }

}).call(this)
;(function () {
  "use strict";

  var root = this

  var CryptoJS, BigInt, EventEmitter, Worker, SMWPath
    , CONST, HLP, Parse, AKE, SM, DSA
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = OTR
    CryptoJS = require('../vendor/crypto.js')
    BigInt = require('../vendor/bigint.js')
    EventEmitter = require('../vendor/eventemitter.js')
    SMWPath = require('path').join(__dirname, '/sm-webworker.js')
    CONST = require('./const.js')
    HLP = require('./helpers.js')
    Parse = require('./parse.js')
    AKE = require('./ake.js')
    SM = require('./sm.js')
    DSA = require('./dsa.js')
    // expose CONST for consistency with docs
    OTR.CONST = CONST
  } else {
    // copy over and expose internals
    Object.keys(root.OTR).forEach(function (k) {
      OTR[k] = root.OTR[k]
    })
    root.OTR = OTR
    CryptoJS = root.CryptoJS
    BigInt = root.BigInt
    EventEmitter = root.EventEmitter
    Worker = root.Worker
    SMWPath = 'sm-webworker.js'
    CONST = OTR.CONST
    HLP = OTR.HLP
    Parse = OTR.Parse
    AKE = OTR.AKE
    SM = OTR.SM
    DSA = root.DSA
  }

  // diffie-hellman modulus and generator
  // see group 5, RFC 3526
  var G = BigInt.str2bigInt(CONST.G, 10)
  var N = BigInt.str2bigInt(CONST.N, 16)

  // JavaScript integers
  var MAX_INT = Math.pow(2, 53) - 1  // doubles
  var MAX_UINT = Math.pow(2, 31) - 1  // bitwise operators

  // OTR contructor
  function OTR(options) {
    if (!(this instanceof OTR)) return new OTR(options)

    // options
    options = options || {}

    // private keys
    if (options.priv && !(options.priv instanceof DSA))
      throw new Error('Requires long-lived DSA key.')

    this.priv = options.priv ? options.priv : new DSA()

    this.fragment_size = options.fragment_size || 0
    if (this.fragment_size < 0)
      throw new Error('Fragment size must be a positive integer.')

    this.send_interval = options.send_interval || 0
    if (this.send_interval < 0)
      throw new Error('Send interval must be a positive integer.')

    this.outgoing = []

    // instance tag
    this.our_instance_tag = options.instance_tag || OTR.makeInstanceTag()

    // debug
    this.debug = !!options.debug

    // smp in webworker options
    // this is still experimental and undocumented
    this.smw = options.smw

    // init vals
    this.init()

    // bind methods
    var self = this
    ;['sendMsg', 'receiveMsg'].forEach(function (meth) {
      self[meth] = self[meth].bind(self)
    })

    EventEmitter.call(this)
  }

  // inherit from EE
  HLP.extend(OTR, EventEmitter)

  // add to prototype
  OTR.prototype.init = function () {

    this.msgstate = CONST.MSGSTATE_PLAINTEXT
    this.authstate = CONST.AUTHSTATE_NONE

    this.ALLOW_V2 = true
    this.ALLOW_V3 = true

    this.REQUIRE_ENCRYPTION = false
    this.SEND_WHITESPACE_TAG = false
    this.WHITESPACE_START_AKE = false
    this.ERROR_START_AKE = false

    Parse.initFragment(this)

    // their keys
    this.their_y = null
    this.their_old_y = null
    this.their_keyid = 0
    this.their_priv_pk = null
    this.their_instance_tag = '\x00\x00\x00\x00'

    // our keys
    this.our_dh = this.dh()
    this.our_old_dh = this.dh()
    this.our_keyid = 2

    // session keys
    this.sessKeys = [ new Array(2), new Array(2) ]

    // saved
    this.storedMgs = []
    this.oldMacKeys = []

    // smp
    this.sm = null  // initialized after AKE

    // when ake is complete
    // save their keys and the session
    this._akeInit()

    // receive plaintext message since switching to plaintext
    // used to decide when to stop sending pt tags when SEND_WHITESPACE_TAG
    this.receivedPlaintext = false

  }

  OTR.prototype._akeInit = function () {
    this.ake = new AKE(this)
    this.transmittedRS = false
    this.ssid = null
  }

  // smp over webworker
  OTR.prototype._SMW = function (otr, reqs) {
    this.otr = otr
    var opts = {
        path: SMWPath
      , seed: BigInt.getSeed
    }
    if (typeof otr.smw === 'object')
      Object.keys(otr.smw).forEach(function (k) {
        opts[k] = otr.smw[k]
      })

    // load optional dep. in node
    if (typeof module !== 'undefined' && module.exports)
      Worker = require('webworker-threads').Worker

    this.worker = new Worker(opts.path)
    var self = this
    this.worker.onmessage = function (e) {
      var d = e.data
      if (!d) return
      self.trigger(d.method, d.args)
    }
    this.worker.postMessage({
        type: 'seed'
      , seed: opts.seed()
      , imports: opts.imports
    })
    this.worker.postMessage({
        type: 'init'
      , reqs: reqs
    })
  }

  // inherit from EE
  HLP.extend(OTR.prototype._SMW, EventEmitter)

  // shim sm methods
  ;['handleSM', 'rcvSecret', 'abort'].forEach(function (m) {
    OTR.prototype._SMW.prototype[m] = function () {
      this.worker.postMessage({
          type: 'method'
        , method: m
        , args: Array.prototype.slice.call(arguments, 0)
      })
    }
  })

  OTR.prototype._smInit = function () {
    var reqs = {
        ssid: this.ssid
      , our_fp: this.priv.fingerprint()
      , their_fp: this.their_priv_pk.fingerprint()
      , debug: this.debug
    }
    if (this.smw) {
      if (this.sm) this.sm.worker.terminate()  // destroy prev webworker
      this.sm = new this._SMW(this, reqs)
    } else {
      this.sm = new SM(reqs)
    }
    var self = this
    ;['trust', 'abort', 'question'].forEach(function (e) {
      self.sm.on(e, function () {
        self.trigger('smp', [e].concat(Array.prototype.slice.call(arguments)))
      })
    })
    this.sm.on('send', function (ssid, send) {
      if (self.ssid === ssid) {
        send = self.prepareMsg(send)
        self.io(send)
      }
    })
  }

  OTR.prototype.io = function (msg, meta) {

    // buffer
    msg = ([].concat(msg)).map(function(m){
       return { msg: m, meta: meta }
    })
    this.outgoing = this.outgoing.concat(msg)

    var self = this
    ;(function send(first) {
      if (!first) {
        if (!self.outgoing.length) return
        var elem = self.outgoing.shift()
        self.trigger('io', [elem.msg, elem.meta])
      }
      setTimeout(send, first ? 0 : self.send_interval)
    }(true))

  }

  OTR.prototype.dh = function dh() {
    var keys = { privateKey: BigInt.randBigInt(320) }
    keys.publicKey = BigInt.powMod(G, keys.privateKey, N)
    return keys
  }

  // session constructor
  OTR.prototype.DHSession = function DHSession(our_dh, their_y) {
    if (!(this instanceof DHSession)) return new DHSession(our_dh, their_y)

    // shared secret
    var s = BigInt.powMod(their_y, our_dh.privateKey, N)
    var secbytes = HLP.packMPI(s)

    // session id
    this.id = HLP.mask(HLP.h2('\x00', secbytes), 0, 64)  // first 64-bits

    // are we the high or low end of the connection?
    var sq = BigInt.greater(our_dh.publicKey, their_y)
    var sendbyte = sq ? '\x01' : '\x02'
    var rcvbyte  = sq ? '\x02' : '\x01'

    // sending and receiving keys
    this.sendenc = HLP.mask(HLP.h1(sendbyte, secbytes), 0, 128)  // f16 bytes
    this.sendmac = CryptoJS.SHA1(CryptoJS.enc.Latin1.parse(this.sendenc))
    this.sendmac = this.sendmac.toString(CryptoJS.enc.Latin1)

    this.rcvenc = HLP.mask(HLP.h1(rcvbyte, secbytes), 0, 128)
    this.rcvmac = CryptoJS.SHA1(CryptoJS.enc.Latin1.parse(this.rcvenc))
    this.rcvmac = this.rcvmac.toString(CryptoJS.enc.Latin1)
    this.rcvmacused = false

    // extra symmetric key
    this.extra_symkey = HLP.h2('\xff', secbytes)

    // counters
    this.send_counter = 0
    this.rcv_counter = 0
  }

  OTR.prototype.rotateOurKeys = function () {

    // reveal old mac keys
    var self = this
    this.sessKeys[1].forEach(function (sk) {
      if (sk && sk.rcvmacused) self.oldMacKeys.push(sk.rcvmac)
    })

    // rotate our keys
    this.our_old_dh = this.our_dh
    this.our_dh = this.dh()
    this.our_keyid += 1

    this.sessKeys[1][0] = this.sessKeys[0][0]
    this.sessKeys[1][1] = this.sessKeys[0][1]
    this.sessKeys[0] = [
        this.their_y ?
            new this.DHSession(this.our_dh, this.their_y) : null
      , this.their_old_y ?
            new this.DHSession(this.our_dh, this.their_old_y) : null
    ]

  }

  OTR.prototype.rotateTheirKeys = function (their_y) {

    // increment their keyid
    this.their_keyid += 1

    // reveal old mac keys
    var self = this
    this.sessKeys.forEach(function (sk) {
      if (sk[1] && sk[1].rcvmacused) self.oldMacKeys.push(sk[1].rcvmac)
    })

    // rotate their keys / session
    this.their_old_y = this.their_y
    this.sessKeys[0][1] = this.sessKeys[0][0]
    this.sessKeys[1][1] = this.sessKeys[1][0]

    // new keys / sessions
    this.their_y = their_y
    this.sessKeys[0][0] = new this.DHSession(this.our_dh, this.their_y)
    this.sessKeys[1][0] = new this.DHSession(this.our_old_dh, this.their_y)

  }

  OTR.prototype.prepareMsg = function (msg, esk) {
    if (this.msgstate !== CONST.MSGSTATE_ENCRYPTED || this.their_keyid === 0)
      return this.error('Not ready to encrypt.')

    var sessKeys = this.sessKeys[1][0]

    if (sessKeys.send_counter >= MAX_INT)
      return this.error('Should have rekeyed by now.')

    sessKeys.send_counter += 1

    var ctr = HLP.packCtr(sessKeys.send_counter)

    var send = this.ake.otr_version + '\x03'  // version and type
    var v3 = (this.ake.otr_version === CONST.OTR_VERSION_3)

    if (v3) {
      send += this.our_instance_tag
      send += this.their_instance_tag
    }

    send += '\x00'  // flag
    send += HLP.packINT(this.our_keyid - 1)
    send += HLP.packINT(this.their_keyid)
    send += HLP.packMPI(this.our_dh.publicKey)
    send += ctr.substring(0, 8)

    if (Math.ceil(msg.length / 8) >= MAX_UINT)  // * 16 / 128
      return this.error('Message is too long.')

    var aes = HLP.encryptAes(
        CryptoJS.enc.Latin1.parse(msg)
      , sessKeys.sendenc
      , ctr
    )

    send += HLP.packData(aes)
    send += HLP.make1Mac(send, sessKeys.sendmac)
    send += HLP.packData(this.oldMacKeys.splice(0).join(''))

    send = HLP.wrapMsg(
        send
      , this.fragment_size
      , v3
      , this.our_instance_tag
      , this.their_instance_tag
    )
    if (send[0]) return this.error(send[0])

    // emit extra symmetric key
    if (esk) this.trigger('file', ['send', sessKeys.extra_symkey, esk])

    return send[1]
  }

  OTR.prototype.handleDataMsg = function (msg) {
    var vt = msg.version + msg.type

    if (this.ake.otr_version === CONST.OTR_VERSION_3)
      vt += msg.instance_tags

    var types = ['BYTE', 'INT', 'INT', 'MPI', 'CTR', 'DATA', 'MAC', 'DATA']
    msg = HLP.splitype(types, msg.msg)

    // ignore flag
    var ign = (msg[0] === '\x01')

    if (this.msgstate !== CONST.MSGSTATE_ENCRYPTED || msg.length !== 8) {
      if (!ign) this.error('Received an unreadable encrypted message.', true)
      return
    }

    var our_keyid = this.our_keyid - HLP.readLen(msg[2])
    var their_keyid = this.their_keyid - HLP.readLen(msg[1])

    if (our_keyid < 0 || our_keyid > 1) {
      if (!ign) this.error('Not of our latest keys.', true)
      return
    }

    if (their_keyid < 0 || their_keyid > 1) {
      if (!ign) this.error('Not of your latest keys.', true)
      return
    }

    var their_y = their_keyid ? this.their_old_y : this.their_y

    if (their_keyid === 1 && !their_y) {
      if (!ign) this.error('Do not have that key.')
      return
    }

    var sessKeys = this.sessKeys[our_keyid][their_keyid]

    var ctr = HLP.unpackCtr(msg[4])
    if (ctr <= sessKeys.rcv_counter) {
      if (!ign) this.error('Counter in message is not larger.')
      return
    }
    sessKeys.rcv_counter = ctr

    // verify mac
    vt += msg.slice(0, 6).join('')
    var vmac = HLP.make1Mac(vt, sessKeys.rcvmac)

    if (!HLP.compare(msg[6], vmac)) {
      if (!ign) this.error('MACs do not match.')
      return
    }
    sessKeys.rcvmacused = true

    var out = HLP.decryptAes(
        msg[5].substring(4)
      , sessKeys.rcvenc
      , HLP.padCtr(msg[4])
    )
    out = out.toString(CryptoJS.enc.Latin1)

    if (!our_keyid) this.rotateOurKeys()
    if (!their_keyid) this.rotateTheirKeys(HLP.readMPI(msg[3]))

    // parse TLVs
    var ind = out.indexOf('\x00')
    if (~ind) {
      this.handleTLVs(out.substring(ind + 1), sessKeys)
      out = out.substring(0, ind)
    }

    out = CryptoJS.enc.Latin1.parse(out)
    return out.toString(CryptoJS.enc.Utf8)
  }

  OTR.prototype.handleTLVs = function (tlvs, sessKeys) {
    var type, len, msg
    for (; tlvs.length; ) {
      type = HLP.unpackSHORT(tlvs.substr(0, 2))
      len = HLP.unpackSHORT(tlvs.substr(2, 2))

      msg = tlvs.substr(4, len)

      // TODO: handle pathological cases better
      if (msg.length < len) break

      switch (type) {
        case 1:
          // Disconnected
          this.msgstate = CONST.MSGSTATE_FINISHED
          this.trigger('status', [CONST.STATUS_END_OTR])
          break
        case 2: case 3: case 4:
        case 5: case 6: case 7:
          // SMP
          if (this.msgstate !== CONST.MSGSTATE_ENCRYPTED) {
            if (this.sm) this.sm.abort()
            return
          }
          if (!this.sm) this._smInit()
          this.sm.handleSM({ msg: msg, type: type })
          break
        case 8:
          // utf8 filenames
          msg = msg.substring(4) // remove 4-byte indication
          msg = CryptoJS.enc.Latin1.parse(msg)
          msg = msg.toString(CryptoJS.enc.Utf8)

          // Extra Symkey
          this.trigger('file', ['receive', sessKeys.extra_symkey, msg])
          break
      }

      tlvs = tlvs.substring(4 + len)
    }
  }

  OTR.prototype.smpSecret = function (secret, question) {
    if (this.msgstate !== CONST.MSGSTATE_ENCRYPTED)
      return this.error('Must be encrypted for SMP.')

    if (typeof secret !== 'string' || secret.length < 1)
      return this.error('Secret is required.')

    if (!this.sm) this._smInit()

    // utf8 inputs
    secret = CryptoJS.enc.Utf8.parse(secret).toString(CryptoJS.enc.Latin1)
    question = CryptoJS.enc.Utf8.parse(question).toString(CryptoJS.enc.Latin1)

    this.sm.rcvSecret(secret, question)
  }

  OTR.prototype.sendQueryMsg = function () {
    var versions = {}
      , msg = CONST.OTR_TAG

    if (this.ALLOW_V2) versions['2'] = true
    if (this.ALLOW_V3) versions['3'] = true

    // but we don't allow v1
    // if (versions['1']) msg += '?'

    var vs = Object.keys(versions)
    if (vs.length) {
      msg += 'v'
      vs.forEach(function (v) {
        if (v !== '1') msg += v
      })
      msg += '?'
    }

    this.io(msg)
    this.trigger('status', [CONST.STATUS_SEND_QUERY])
  }

  OTR.prototype.sendMsg = function (msg, meta) {
    if ( this.REQUIRE_ENCRYPTION ||
         this.msgstate !== CONST.MSGSTATE_PLAINTEXT
    ) {
      msg = CryptoJS.enc.Utf8.parse(msg)
      msg = msg.toString(CryptoJS.enc.Latin1)
    }

    switch (this.msgstate) {
      case CONST.MSGSTATE_PLAINTEXT:
        if (this.REQUIRE_ENCRYPTION) {
          this.storedMgs.push({msg: msg, meta: meta})
          this.sendQueryMsg()
          return
        }
        if (this.SEND_WHITESPACE_TAG && !this.receivedPlaintext) {
          msg += CONST.WHITESPACE_TAG  // 16 byte tag
          if (this.ALLOW_V3) msg += CONST.WHITESPACE_TAG_V3
          if (this.ALLOW_V2) msg += CONST.WHITESPACE_TAG_V2
        }
        break
      case CONST.MSGSTATE_FINISHED:
        this.storedMgs.push({msg: msg, meta: meta})
        this.error('Message cannot be sent at this time.')
        return
      case CONST.MSGSTATE_ENCRYPTED:
        msg = this.prepareMsg(msg)
        break
      default:
        throw new Error('Unknown message state.')
    }

    if (msg) this.io(msg, meta)
  }

  OTR.prototype.receiveMsg = function (msg) {

    // parse type
    msg = Parse.parseMsg(this, msg)

    if (!msg) return

    switch (msg.cls) {
      case 'error':
        this.error(msg.msg)
        return
      case 'ake':
        if ( msg.version === CONST.OTR_VERSION_3 &&
          this.checkInstanceTags(msg.instance_tags)
        ) return  // ignore
        this.ake.handleAKE(msg)
        return
      case 'data':
        if ( msg.version === CONST.OTR_VERSION_3 &&
          this.checkInstanceTags(msg.instance_tags)
        ) return  // ignore
        msg.msg = this.handleDataMsg(msg)
        msg.encrypted = true
        break
      case 'query':
        if (this.msgstate === CONST.MSGSTATE_ENCRYPTED) this._akeInit()
        this.doAKE(msg)
        break
      default:
        // check for encrypted
        if ( this.REQUIRE_ENCRYPTION ||
             this.msgstate !== CONST.MSGSTATE_PLAINTEXT
        ) this.error('Received an unencrypted message.')

        // received a plaintext message
        // stop sending the whitespace tag
        this.receivedPlaintext = true

        // received a whitespace tag
        if (this.WHITESPACE_START_AKE && msg.ver.length > 0)
          this.doAKE(msg)
    }

    if (msg.msg) this.trigger('ui', [msg.msg, !!msg.encrypted])
  }

  OTR.prototype.checkInstanceTags = function (it) {
    var their_it = HLP.readLen(it.substr(0, 4))
    var our_it = HLP.readLen(it.substr(4, 4))

    if (our_it && our_it !== HLP.readLen(this.our_instance_tag))
      return true

    if (HLP.readLen(this.their_instance_tag)) {
      if (HLP.readLen(this.their_instance_tag) !== their_it) return true
    } else {
      if (their_it < 100) return true
      this.their_instance_tag = HLP.packINT(their_it)
    }
  }

  OTR.prototype.doAKE = function (msg) {
    if (this.ALLOW_V3 && ~msg.ver.indexOf(CONST.OTR_VERSION_3)) {
      this.ake.initiateAKE(CONST.OTR_VERSION_3)
    } else if (this.ALLOW_V2 && ~msg.ver.indexOf(CONST.OTR_VERSION_2)) {
      this.ake.initiateAKE(CONST.OTR_VERSION_2)
    } else {
      // is this an error?
      this.error('OTR conversation requested, ' +
        'but no compatible protocol version found.')
    }
  }

  OTR.prototype.error = function (err, send) {
    if (send) {
      if (!this.debug) err = "An OTR error has occurred."
      err = '?OTR Error:' + err
      this.io(err)
      return
    }
    this.trigger('error', [err])
  }

  OTR.prototype.sendStored = function () {
    var self = this
    ;(this.storedMgs.splice(0)).forEach(function (elem) {
      var msg = self.prepareMsg(elem.msg)
      self.io(msg, elem.meta)
    })
  }

  OTR.prototype.sendFile = function (filename) {
    if (this.msgstate !== CONST.MSGSTATE_ENCRYPTED)
      return this.error('Not ready to encrypt.')

    if (this.ake.otr_version !== CONST.OTR_VERSION_3)
      return this.error('Protocol v3 required.')

    if (!filename) return this.error('Please specify a filename.')

    // utf8 filenames
    var l1name = CryptoJS.enc.Utf8.parse(filename)
    l1name = l1name.toString(CryptoJS.enc.Latin1)

    if (l1name.length >= 65532) return this.error('filename is too long.')

    var msg = '\x00'  // null byte
    msg += '\x00\x08'  // type 8 tlv
    msg += HLP.packSHORT(4 + l1name.length)  // length of value
    msg += '\x00\x00\x00\x01'  // four bytes indicating file
    msg += l1name

    msg = this.prepareMsg(msg, filename)
    this.io(msg)
  }

  OTR.prototype.endOtr = function () {
    if (this.msgstate === CONST.MSGSTATE_ENCRYPTED) {
      this.sendMsg('\x00\x00\x01\x00\x00')
      if (this.sm) {
        if (this.smw) this.sm.worker.terminate()  // destroy webworker
        this.sm = null
      }
    }
    this.msgstate = CONST.MSGSTATE_PLAINTEXT
    this.receivedPlaintext = false
    this.trigger('status', [CONST.STATUS_END_OTR])
  }

  // attach methods

  OTR.makeInstanceTag = function () {
    var num = BigInt.randBigInt(32)
    if (BigInt.greater(BigInt.str2bigInt('100', 16), num))
      return OTR.makeInstanceTag()
    return HLP.packINT(parseInt(BigInt.bigInt2str(num, 10), 10))
  }

}).call(this)


  return {
      OTR: this.OTR
    , DSA: this.DSA
  }

}))
