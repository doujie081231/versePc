"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};

// index.ts
var asm_exports = {};
__export(asm_exports, {
  AnnotationVisitor: () => AnnotationVisitor,
  Attribute: () => Attribute,
  ClassReader: () => ClassReader,
  ClassVisitor: () => ClassVisitor,
  FieldVisitor: () => FieldVisitor,
  Handle: () => Handle,
  Label: () => Label,
  MethodVisitor: () => MethodVisitor,
  Opcodes: () => Opcodes,
  Type: () => Type,
  TypePath: () => TypePath,
  TypeReference: () => TypeReference
});
module.exports = __toCommonJS(asm_exports);

// libs/Opcodes.ts
var Opcodes = /* @__PURE__ */ ((Opcodes2) => {
  Opcodes2[Opcodes2["ASM4"] = 262144] = "ASM4";
  Opcodes2[Opcodes2["ASM5"] = 327680] = "ASM5";
  Opcodes2[Opcodes2["V1_1"] = 196653] = "V1_1";
  Opcodes2[Opcodes2["V1_2"] = 46] = "V1_2";
  Opcodes2[Opcodes2["V1_3"] = 47] = "V1_3";
  Opcodes2[Opcodes2["V1_4"] = 48] = "V1_4";
  Opcodes2[Opcodes2["V1_5"] = 49] = "V1_5";
  Opcodes2[Opcodes2["V1_6"] = 50] = "V1_6";
  Opcodes2[Opcodes2["V1_7"] = 51] = "V1_7";
  Opcodes2[Opcodes2["V1_8"] = 52] = "V1_8";
  Opcodes2[Opcodes2["ACC_PUBLIC"] = 1] = "ACC_PUBLIC";
  Opcodes2[Opcodes2["ACC_PRIVATE"] = 2] = "ACC_PRIVATE";
  Opcodes2[Opcodes2["ACC_PROTECTED"] = 4] = "ACC_PROTECTED";
  Opcodes2[Opcodes2["ACC_STATIC"] = 8] = "ACC_STATIC";
  Opcodes2[Opcodes2["ACC_FINAL"] = 16] = "ACC_FINAL";
  Opcodes2[Opcodes2["ACC_SUPER"] = 32] = "ACC_SUPER";
  Opcodes2[Opcodes2["ACC_SYNCHRONIZED"] = 32] = "ACC_SYNCHRONIZED";
  Opcodes2[Opcodes2["ACC_VOLATILE"] = 64] = "ACC_VOLATILE";
  Opcodes2[Opcodes2["ACC_BRIDGE"] = 64] = "ACC_BRIDGE";
  Opcodes2[Opcodes2["ACC_VARARGS"] = 128] = "ACC_VARARGS";
  Opcodes2[Opcodes2["ACC_TRANSIENT"] = 128] = "ACC_TRANSIENT";
  Opcodes2[Opcodes2["ACC_NATIVE"] = 256] = "ACC_NATIVE";
  Opcodes2[Opcodes2["ACC_INTERFACE"] = 512] = "ACC_INTERFACE";
  Opcodes2[Opcodes2["ACC_ABSTRACT"] = 1024] = "ACC_ABSTRACT";
  Opcodes2[Opcodes2["ACC_STRICT"] = 2048] = "ACC_STRICT";
  Opcodes2[Opcodes2["ACC_SYNTHETIC"] = 4096] = "ACC_SYNTHETIC";
  Opcodes2[Opcodes2["ACC_ANNOTATION"] = 8192] = "ACC_ANNOTATION";
  Opcodes2[Opcodes2["ACC_ENUM"] = 16384] = "ACC_ENUM";
  Opcodes2[Opcodes2["ACC_MANDATED"] = 32768] = "ACC_MANDATED";
  Opcodes2[Opcodes2["ACC_DEPRECATED"] = 131072] = "ACC_DEPRECATED";
  Opcodes2[Opcodes2["T_BOOLEAN"] = 4] = "T_BOOLEAN";
  Opcodes2[Opcodes2["T_CHAR"] = 5] = "T_CHAR";
  Opcodes2[Opcodes2["T_FLOAT"] = 6] = "T_FLOAT";
  Opcodes2[Opcodes2["T_DOUBLE"] = 7] = "T_DOUBLE";
  Opcodes2[Opcodes2["T_BYTE"] = 8] = "T_BYTE";
  Opcodes2[Opcodes2["T_SHORT"] = 9] = "T_SHORT";
  Opcodes2[Opcodes2["T_INT"] = 10] = "T_INT";
  Opcodes2[Opcodes2["T_LONG"] = 11] = "T_LONG";
  Opcodes2[Opcodes2["H_GETFIELD"] = 1] = "H_GETFIELD";
  Opcodes2[Opcodes2["H_GETSTATIC"] = 2] = "H_GETSTATIC";
  Opcodes2[Opcodes2["H_PUTFIELD"] = 3] = "H_PUTFIELD";
  Opcodes2[Opcodes2["H_PUTSTATIC"] = 4] = "H_PUTSTATIC";
  Opcodes2[Opcodes2["H_INVOKEVIRTUAL"] = 5] = "H_INVOKEVIRTUAL";
  Opcodes2[Opcodes2["H_INVOKESTATIC"] = 6] = "H_INVOKESTATIC";
  Opcodes2[Opcodes2["H_INVOKESPECIAL"] = 7] = "H_INVOKESPECIAL";
  Opcodes2[Opcodes2["H_NEWINVOKESPECIAL"] = 8] = "H_NEWINVOKESPECIAL";
  Opcodes2[Opcodes2["H_INVOKEINTERFACE"] = 9] = "H_INVOKEINTERFACE";
  Opcodes2[Opcodes2["F_NEW"] = -1] = "F_NEW";
  Opcodes2[Opcodes2["F_FULL"] = 0] = "F_FULL";
  Opcodes2[Opcodes2["F_APPEND"] = 1] = "F_APPEND";
  Opcodes2[Opcodes2["F_CHOP"] = 2] = "F_CHOP";
  Opcodes2[Opcodes2["F_SAME"] = 3] = "F_SAME";
  Opcodes2[Opcodes2["F_SAME1"] = 4] = "F_SAME1";
  Opcodes2[Opcodes2["TOP"] = 0] = "TOP";
  Opcodes2[Opcodes2["INTEGER"] = 1] = "INTEGER";
  Opcodes2[Opcodes2["FLOAT"] = 2] = "FLOAT";
  Opcodes2[Opcodes2["DOUBLE"] = 3] = "DOUBLE";
  Opcodes2[Opcodes2["LONG"] = 4] = "LONG";
  Opcodes2[Opcodes2["NULL"] = 5] = "NULL";
  Opcodes2[Opcodes2["UNINITIALIZED_THIS"] = 6] = "UNINITIALIZED_THIS";
  Opcodes2[Opcodes2["NOP"] = 0] = "NOP";
  Opcodes2[Opcodes2["ACONST_NULL"] = 1] = "ACONST_NULL";
  Opcodes2[Opcodes2["ICONST_M1"] = 2] = "ICONST_M1";
  Opcodes2[Opcodes2["ICONST_0"] = 3] = "ICONST_0";
  Opcodes2[Opcodes2["ICONST_1"] = 4] = "ICONST_1";
  Opcodes2[Opcodes2["ICONST_2"] = 5] = "ICONST_2";
  Opcodes2[Opcodes2["ICONST_3"] = 6] = "ICONST_3";
  Opcodes2[Opcodes2["ICONST_4"] = 7] = "ICONST_4";
  Opcodes2[Opcodes2["ICONST_5"] = 8] = "ICONST_5";
  Opcodes2[Opcodes2["LCONST_0"] = 9] = "LCONST_0";
  Opcodes2[Opcodes2["LCONST_1"] = 10] = "LCONST_1";
  Opcodes2[Opcodes2["FCONST_0"] = 11] = "FCONST_0";
  Opcodes2[Opcodes2["FCONST_1"] = 12] = "FCONST_1";
  Opcodes2[Opcodes2["FCONST_2"] = 13] = "FCONST_2";
  Opcodes2[Opcodes2["DCONST_0"] = 14] = "DCONST_0";
  Opcodes2[Opcodes2["DCONST_1"] = 15] = "DCONST_1";
  Opcodes2[Opcodes2["BIPUSH"] = 16] = "BIPUSH";
  Opcodes2[Opcodes2["SIPUSH"] = 17] = "SIPUSH";
  Opcodes2[Opcodes2["LDC"] = 18] = "LDC";
  Opcodes2[Opcodes2["ILOAD"] = 21] = "ILOAD";
  Opcodes2[Opcodes2["LLOAD"] = 22] = "LLOAD";
  Opcodes2[Opcodes2["FLOAD"] = 23] = "FLOAD";
  Opcodes2[Opcodes2["DLOAD"] = 24] = "DLOAD";
  Opcodes2[Opcodes2["ALOAD"] = 25] = "ALOAD";
  Opcodes2[Opcodes2["IALOAD"] = 46] = "IALOAD";
  Opcodes2[Opcodes2["LALOAD"] = 47] = "LALOAD";
  Opcodes2[Opcodes2["FALOAD"] = 48] = "FALOAD";
  Opcodes2[Opcodes2["DALOAD"] = 49] = "DALOAD";
  Opcodes2[Opcodes2["AALOAD"] = 50] = "AALOAD";
  Opcodes2[Opcodes2["BALOAD"] = 51] = "BALOAD";
  Opcodes2[Opcodes2["CALOAD"] = 52] = "CALOAD";
  Opcodes2[Opcodes2["SALOAD"] = 53] = "SALOAD";
  Opcodes2[Opcodes2["ISTORE"] = 54] = "ISTORE";
  Opcodes2[Opcodes2["LSTORE"] = 55] = "LSTORE";
  Opcodes2[Opcodes2["FSTORE"] = 56] = "FSTORE";
  Opcodes2[Opcodes2["DSTORE"] = 57] = "DSTORE";
  Opcodes2[Opcodes2["ASTORE"] = 58] = "ASTORE";
  Opcodes2[Opcodes2["IASTORE"] = 79] = "IASTORE";
  Opcodes2[Opcodes2["LASTORE"] = 80] = "LASTORE";
  Opcodes2[Opcodes2["FASTORE"] = 81] = "FASTORE";
  Opcodes2[Opcodes2["DASTORE"] = 82] = "DASTORE";
  Opcodes2[Opcodes2["AASTORE"] = 83] = "AASTORE";
  Opcodes2[Opcodes2["BASTORE"] = 84] = "BASTORE";
  Opcodes2[Opcodes2["CASTORE"] = 85] = "CASTORE";
  Opcodes2[Opcodes2["SASTORE"] = 86] = "SASTORE";
  Opcodes2[Opcodes2["POP"] = 87] = "POP";
  Opcodes2[Opcodes2["POP2"] = 88] = "POP2";
  Opcodes2[Opcodes2["DUP"] = 89] = "DUP";
  Opcodes2[Opcodes2["DUP_X1"] = 90] = "DUP_X1";
  Opcodes2[Opcodes2["DUP_X2"] = 91] = "DUP_X2";
  Opcodes2[Opcodes2["DUP2"] = 92] = "DUP2";
  Opcodes2[Opcodes2["DUP2_X1"] = 93] = "DUP2_X1";
  Opcodes2[Opcodes2["DUP2_X2"] = 94] = "DUP2_X2";
  Opcodes2[Opcodes2["SWAP"] = 95] = "SWAP";
  Opcodes2[Opcodes2["IADD"] = 96] = "IADD";
  Opcodes2[Opcodes2["LADD"] = 97] = "LADD";
  Opcodes2[Opcodes2["FADD"] = 98] = "FADD";
  Opcodes2[Opcodes2["DADD"] = 99] = "DADD";
  Opcodes2[Opcodes2["ISUB"] = 100] = "ISUB";
  Opcodes2[Opcodes2["LSUB"] = 101] = "LSUB";
  Opcodes2[Opcodes2["FSUB"] = 102] = "FSUB";
  Opcodes2[Opcodes2["DSUB"] = 103] = "DSUB";
  Opcodes2[Opcodes2["IMUL"] = 104] = "IMUL";
  Opcodes2[Opcodes2["LMUL"] = 105] = "LMUL";
  Opcodes2[Opcodes2["FMUL"] = 106] = "FMUL";
  Opcodes2[Opcodes2["DMUL"] = 107] = "DMUL";
  Opcodes2[Opcodes2["IDIV"] = 108] = "IDIV";
  Opcodes2[Opcodes2["LDIV"] = 109] = "LDIV";
  Opcodes2[Opcodes2["FDIV"] = 110] = "FDIV";
  Opcodes2[Opcodes2["DDIV"] = 111] = "DDIV";
  Opcodes2[Opcodes2["IREM"] = 112] = "IREM";
  Opcodes2[Opcodes2["LREM"] = 113] = "LREM";
  Opcodes2[Opcodes2["FREM"] = 114] = "FREM";
  Opcodes2[Opcodes2["DREM"] = 115] = "DREM";
  Opcodes2[Opcodes2["INEG"] = 116] = "INEG";
  Opcodes2[Opcodes2["LNEG"] = 117] = "LNEG";
  Opcodes2[Opcodes2["FNEG"] = 118] = "FNEG";
  Opcodes2[Opcodes2["DNEG"] = 119] = "DNEG";
  Opcodes2[Opcodes2["ISHL"] = 120] = "ISHL";
  Opcodes2[Opcodes2["LSHL"] = 121] = "LSHL";
  Opcodes2[Opcodes2["ISHR"] = 122] = "ISHR";
  Opcodes2[Opcodes2["LSHR"] = 123] = "LSHR";
  Opcodes2[Opcodes2["IUSHR"] = 124] = "IUSHR";
  Opcodes2[Opcodes2["LUSHR"] = 125] = "LUSHR";
  Opcodes2[Opcodes2["IAND"] = 126] = "IAND";
  Opcodes2[Opcodes2["LAND"] = 127] = "LAND";
  Opcodes2[Opcodes2["IOR"] = 128] = "IOR";
  Opcodes2[Opcodes2["LOR"] = 129] = "LOR";
  Opcodes2[Opcodes2["IXOR"] = 130] = "IXOR";
  Opcodes2[Opcodes2["LXOR"] = 131] = "LXOR";
  Opcodes2[Opcodes2["IINC"] = 132] = "IINC";
  Opcodes2[Opcodes2["I2L"] = 133] = "I2L";
  Opcodes2[Opcodes2["I2F"] = 134] = "I2F";
  Opcodes2[Opcodes2["I2D"] = 135] = "I2D";
  Opcodes2[Opcodes2["L2I"] = 136] = "L2I";
  Opcodes2[Opcodes2["L2F"] = 137] = "L2F";
  Opcodes2[Opcodes2["L2D"] = 138] = "L2D";
  Opcodes2[Opcodes2["F2I"] = 139] = "F2I";
  Opcodes2[Opcodes2["F2L"] = 140] = "F2L";
  Opcodes2[Opcodes2["F2D"] = 141] = "F2D";
  Opcodes2[Opcodes2["D2I"] = 142] = "D2I";
  Opcodes2[Opcodes2["D2L"] = 143] = "D2L";
  Opcodes2[Opcodes2["D2F"] = 144] = "D2F";
  Opcodes2[Opcodes2["I2B"] = 145] = "I2B";
  Opcodes2[Opcodes2["I2C"] = 146] = "I2C";
  Opcodes2[Opcodes2["I2S"] = 147] = "I2S";
  Opcodes2[Opcodes2["LCMP"] = 148] = "LCMP";
  Opcodes2[Opcodes2["FCMPL"] = 149] = "FCMPL";
  Opcodes2[Opcodes2["FCMPG"] = 150] = "FCMPG";
  Opcodes2[Opcodes2["DCMPL"] = 151] = "DCMPL";
  Opcodes2[Opcodes2["DCMPG"] = 152] = "DCMPG";
  Opcodes2[Opcodes2["IFEQ"] = 153] = "IFEQ";
  Opcodes2[Opcodes2["IFNE"] = 154] = "IFNE";
  Opcodes2[Opcodes2["IFLT"] = 155] = "IFLT";
  Opcodes2[Opcodes2["IFGE"] = 156] = "IFGE";
  Opcodes2[Opcodes2["IFGT"] = 157] = "IFGT";
  Opcodes2[Opcodes2["IFLE"] = 158] = "IFLE";
  Opcodes2[Opcodes2["IF_ICMPEQ"] = 159] = "IF_ICMPEQ";
  Opcodes2[Opcodes2["IF_ICMPNE"] = 160] = "IF_ICMPNE";
  Opcodes2[Opcodes2["IF_ICMPLT"] = 161] = "IF_ICMPLT";
  Opcodes2[Opcodes2["IF_ICMPGE"] = 162] = "IF_ICMPGE";
  Opcodes2[Opcodes2["IF_ICMPGT"] = 163] = "IF_ICMPGT";
  Opcodes2[Opcodes2["IF_ICMPLE"] = 164] = "IF_ICMPLE";
  Opcodes2[Opcodes2["IF_ACMPEQ"] = 165] = "IF_ACMPEQ";
  Opcodes2[Opcodes2["IF_ACMPNE"] = 166] = "IF_ACMPNE";
  Opcodes2[Opcodes2["GOTO"] = 167] = "GOTO";
  Opcodes2[Opcodes2["JSR"] = 168] = "JSR";
  Opcodes2[Opcodes2["RET"] = 169] = "RET";
  Opcodes2[Opcodes2["TABLESWITCH"] = 170] = "TABLESWITCH";
  Opcodes2[Opcodes2["LOOKUPSWITCH"] = 171] = "LOOKUPSWITCH";
  Opcodes2[Opcodes2["IRETURN"] = 172] = "IRETURN";
  Opcodes2[Opcodes2["LRETURN"] = 173] = "LRETURN";
  Opcodes2[Opcodes2["FRETURN"] = 174] = "FRETURN";
  Opcodes2[Opcodes2["DRETURN"] = 175] = "DRETURN";
  Opcodes2[Opcodes2["ARETURN"] = 176] = "ARETURN";
  Opcodes2[Opcodes2["RETURN"] = 177] = "RETURN";
  Opcodes2[Opcodes2["GETSTATIC"] = 178] = "GETSTATIC";
  Opcodes2[Opcodes2["PUTSTATIC"] = 179] = "PUTSTATIC";
  Opcodes2[Opcodes2["GETFIELD"] = 180] = "GETFIELD";
  Opcodes2[Opcodes2["PUTFIELD"] = 181] = "PUTFIELD";
  Opcodes2[Opcodes2["INVOKEVIRTUAL"] = 182] = "INVOKEVIRTUAL";
  Opcodes2[Opcodes2["INVOKESPECIAL"] = 183] = "INVOKESPECIAL";
  Opcodes2[Opcodes2["INVOKESTATIC"] = 184] = "INVOKESTATIC";
  Opcodes2[Opcodes2["INVOKEINTERFACE"] = 185] = "INVOKEINTERFACE";
  Opcodes2[Opcodes2["INVOKEDYNAMIC"] = 186] = "INVOKEDYNAMIC";
  Opcodes2[Opcodes2["NEW"] = 187] = "NEW";
  Opcodes2[Opcodes2["NEWARRAY"] = 188] = "NEWARRAY";
  Opcodes2[Opcodes2["ANEWARRAY"] = 189] = "ANEWARRAY";
  Opcodes2[Opcodes2["ARRAYLENGTH"] = 190] = "ARRAYLENGTH";
  Opcodes2[Opcodes2["ATHROW"] = 191] = "ATHROW";
  Opcodes2[Opcodes2["CHECKCAST"] = 192] = "CHECKCAST";
  Opcodes2[Opcodes2["INSTANCEOF"] = 193] = "INSTANCEOF";
  Opcodes2[Opcodes2["MONITORENTER"] = 194] = "MONITORENTER";
  Opcodes2[Opcodes2["MONITOREXIT"] = 195] = "MONITOREXIT";
  Opcodes2[Opcodes2["MULTIANEWARRAY"] = 197] = "MULTIANEWARRAY";
  Opcodes2[Opcodes2["IFNULL"] = 198] = "IFNULL";
  Opcodes2[Opcodes2["IFNONNULL"] = 199] = "IFNONNULL";
  return Opcodes2;
})(Opcodes || {});

// libs/AnnotationVisitor.ts
var AnnotationVisitor = class {
  /**
     * Constructs a new {@link AnnotationVisitor}.
     *
     * @param api
     * the ASM API version implemented by this visitor. Must be one
     * of {@link Opcodes#ASM4} or {@link Opcodes#ASM5}.
     * @param av
     * the annotation visitor to which this visitor must delegate
     * method calls. May be null.
     */
  constructor(api, av = null) {
    /**
       * The ASM API version implemented by this visitor. The value of this field
       * must be one of {@link Opcodes#ASM4} or {@link Opcodes#ASM5}.
       */
    __publicField(this, "api");
    /**
       * The annotation visitor to which this visitor must delegate method calls.
       * May be null.
       */
    __publicField(this, "av");
    this.api = 0;
    if (api !== 262144 /* ASM4 */ && api !== 327680 /* ASM5 */) {
      throw new Error();
    }
    this.api = api;
    this.av = av;
  }
  /**
     * Visits a primitive value of the annotation.
     *
     * @param name
     * the value name.
     * @param value
     * the actual value, whose type must be {@link Byte},
     * {@link Boolean}, {@link Character}, {@link Short},
     * {@link Integer} , {@link Long}, {@link Float}, {@link Double},
     * {@link String} or {@link Type} of OBJECT or ARRAY sort. This
     * value can also be an array of byte, boolean, short, char, int,
     * long, float or double values (this is equivalent to using
     * {@link #visitArray visitArray} and visiting each array element
     * in turn, but is more convenient).
     */
  visit(name, value) {
    if (this.av != null) {
      this.av.visit(name, value);
    }
  }
  /**
     * Visits an enumeration value of the annotation.
     *
     * @param name
     * the value name.
     * @param desc
     * the class descriptor of the enumeration class.
     * @param value
     * the actual enumeration value.
     */
  visitEnum(name, desc, value) {
    if (this.av != null) {
      this.av.visitEnum(name, desc, value);
    }
  }
  /**
     * Visits a nested annotation value of the annotation.
     *
     * @param name
     * the value name.
     * @param desc
     * the class descriptor of the nested annotation class.
     * @return a visitor to visit the actual nested annotation value, or
     * <tt>null</tt> if this visitor is not interested in visiting this
     * nested annotation. <i>The nested annotation value must be fully
     * visited before calling other methods on this annotation
     * visitor</i>.
     */
  visitAnnotation(name, desc) {
    if (this.av != null) {
      return this.av.visitAnnotation(name, desc);
    }
    return null;
  }
  /**
     * Visits an array value of the annotation. Note that arrays of primitive
     * types (such as byte, boolean, short, char, int, long, float or double)
     * can be passed as value to {@link #visit visit}. This is what
     * {@link ClassReader} does.
     *
     * @param name
     * the value name.
     * @return a visitor to visit the actual array value elements, or
     * <tt>null</tt> if this visitor is not interested in visiting these
     * values. The 'name' parameters passed to the methods of this
     * visitor are ignored. <i>All the array values must be visited
     * before calling other methods on this annotation visitor</i>.
     */
  visitArray(name) {
    if (this.av != null) {
      return this.av.visitArray(name);
    }
    return null;
  }
  /**
     * Visits the end of the annotation.
     */
  visitEnd() {
    if (this.av != null) {
      this.av.visitEnd();
    }
  }
};

// libs/ByteVector.ts
var ByteVector = class {
  /**
     * Constructs a new {@link ByteVector ByteVector} with the given initial
     * size.
     *
     * @param initialSize
     * the initial size of the byte vector to be constructed.
     */
  constructor(initialSize = 64) {
    /**
       * The content of this vector.
       */
    __publicField(this, "data");
    /**
       * Actual number of bytes in this vector.
       */
    __publicField(this, "length", 0);
    this.data = new Uint8Array(initialSize);
  }
  /**
     * Puts a byte into this byte vector. The byte vector is automatically
     * enlarged if necessary.
     *
     * @param b
     * a byte.
     * @return this byte vector.
     */
  putByte(b) {
    let length = this.length;
    if (length + 1 > this.data.length) {
      this.enlarge(1);
    }
    this.data[length++] = b | 0;
    this.length = length;
    return this;
  }
  /**
     * Puts two bytes into this byte vector. The byte vector is automatically
     * enlarged if necessary.
     *
     * @param b1
     * a byte.
     * @param b2
     * another byte.
     * @return this byte vector.
     */
  put11(b1, b2) {
    let length = this.length;
    if (length + 2 > this.data.length) {
      this.enlarge(2);
    }
    const data = this.data;
    data[length++] = b1 | 0;
    data[length++] = b2 | 0;
    this.length = length;
    return this;
  }
  /**
     * Puts a short into this byte vector. The byte vector is automatically
     * enlarged if necessary.
     *
     * @param s
     * a short.
     * @return this byte vector.
     */
  putShort(s) {
    let length = this.length;
    if (length + 2 > this.data.length) {
      this.enlarge(2);
    }
    const data = this.data;
    data[length++] = s >>> 8 | 0;
    data[length++] = s | 0;
    this.length = length;
    return this;
  }
  /**
     * Puts a byte and a short into this byte vector. The byte vector is
     * automatically enlarged if necessary.
     *
     * @param b a byte.
     * @param s a short.
     * @return this byte vector.
     */
  put12(b, s) {
    let length = this.length;
    if (length + 3 > this.data.length) {
      this.enlarge(3);
    }
    const data = this.data;
    data[length++] = b | 0;
    data[length++] = s >>> 8 | 0;
    data[length++] = s | 0;
    this.length = length;
    return this;
  }
  /**
     * Puts an int into this byte vector. The byte vector is automatically
     * enlarged if necessary.
     *
     * @param i
     * an int.
     * @return this byte vector.
     */
  putInt(i) {
    let length = this.length;
    if (length + 4 > this.data.length) {
      this.enlarge(4);
    }
    const data = this.data;
    data[length++] = i >>> 24 | 0;
    data[length++] = i >>> 16 | 0;
    data[length++] = i >>> 8 | 0;
    data[length++] = i | 0;
    this.length = length;
    return this;
  }
  /**
     * Puts a long into this byte vector. The byte vector is automatically
     * enlarged if necessary.
     *
     * @param l
     * a long.
     * @return this byte vector.
     */
  putLong(l) {
    let length = this.length;
    if (length + 8 > this.data.length) {
      this.enlarge(8);
    }
    const data = this.data;
    let i = Number(l >> 32n & 0xffffffffn);
    data[length++] = i >>> 24 & 256;
    data[length++] = i >>> 16 & 256;
    data[length++] = i >>> 8 & 256;
    data[length++] = i & 256;
    i = Number(l & 0xffffffffn);
    data[length++] = i >>> 24 & 256;
    data[length++] = i >>> 16 & 256;
    data[length++] = i >>> 8 & 256;
    data[length++] = i & 256;
    this.length = length;
    return this;
  }
  /**
     * Puts an UTF8 string into this byte vector. The byte vector is
     * automatically enlarged if necessary.
     *
     * @param s
     * a String whose UTF8 encoded length must be less than 65536.
     * @return this byte vector.
     */
  putUTF8(s) {
    const charLength = s.length;
    if (charLength > 65535) {
      throw new Error();
    }
    let len = this.length;
    if (len + 2 + charLength > this.data.length) {
      this.enlarge(2 + charLength);
    }
    const data = this.data;
    data[len++] = charLength >>> 8 | 0;
    data[len++] = charLength | 0;
    for (let i = 0; i < charLength; ++i) {
      const c = s.charAt(i);
      if (c.charCodeAt(0) >= "".charCodeAt(0) && c.charCodeAt(0) <= "\x7F".charCodeAt(0)) {
        data[len++] = c.charCodeAt(0);
      } else {
        this.length = len;
        return this.encodeUTF8(s, i, 65535);
      }
    }
    this.length = len;
    return this;
  }
  /**
     * Puts an UTF8 string into this byte vector. The byte vector is
     * automatically enlarged if necessary. The string length is encoded in two
     * bytes before the encoded characters, if there is space for that (i.e. if
     * this.length - i - 2 >= 0).
     *
     * @param s
     * the String to encode.
     * @param i
     * the index of the first character to encode. The previous
     * characters are supposed to have already been encoded, using
     * only one byte per character.
     * @param maxByteLength
     * the maximum byte length of the encoded string, including the
     * already encoded characters.
     * @return this byte vector.
     */
  encodeUTF8(s, i, maxByteLength) {
    const charLength = s.length;
    let byteLength = i;
    let c;
    for (let j = i; j < charLength; ++j) {
      c = s.charAt(j);
      if (c.charCodeAt(0) >= "".charCodeAt(0) && c.charCodeAt(0) <= "\x7F".charCodeAt(0)) {
        byteLength++;
      } else if (c.charCodeAt(0) > "\u07FF".charCodeAt(0)) {
        byteLength += 3;
      } else {
        byteLength += 2;
      }
    }
    if (byteLength > maxByteLength) {
      throw new Error();
    }
    const start = this.length - i - 2;
    if (start >= 0) {
      this.data[start] = byteLength >>> 8 | 0;
      this.data[start + 1] = byteLength | 0;
    }
    if (this.length + byteLength - i > this.data.length) {
      this.enlarge(byteLength - i);
    }
    let len = this.length;
    for (let j = i; j < charLength; ++j) {
      c = s.charAt(j);
      if (c.charCodeAt(0) >= "".charCodeAt(0) && c.charCodeAt(0) <= "\x7F".charCodeAt(0)) {
        this.data[len++] = c.charCodeAt(0);
      } else if (c.charCodeAt(0) > "\u07FF".charCodeAt(0)) {
        this.data[len++] = 224 | c.charCodeAt(0) >> 12 & 15 | 0;
        this.data[len++] = 128 | c.charCodeAt(0) >> 6 & 63 | 0;
        this.data[len++] = 128 | c.charCodeAt(0) & 63 | 0;
      } else {
        this.data[len++] = 192 | c.charCodeAt(0) >> 6 & 31 | 0;
        this.data[len++] = 128 | c.charCodeAt(0) & 63 | 0;
      }
    }
    this.length = len;
    return this;
  }
  /**
     * Puts an array of bytes into this byte vector. The byte vector is
     * automatically enlarged if necessary.
     *
     * @param b
     * an array of bytes. May be <tt>null</tt> to put <tt>len</tt>
     * null bytes into this byte vector.
     * @param off
     * index of the fist byte of b that must be copied.
     * @param len
     * number of bytes of b that must be copied.
     * @return this byte vector.
     */
  putByteArray(b, off, len) {
    if (this.length + len > this.data.length) {
      this.enlarge(len);
    }
    if (b != null) {
      for (let i = 0; i < len; i++) {
        this.data[i + this.length] = b[i + off];
      }
    }
    this.length += len;
    return this;
  }
  /**
     * Enlarge this byte vector so that it can receive n more bytes.
     *
     * @param size
     * number of additional bytes that this byte vector should be
     * able to receive.
     */
  enlarge(size) {
    const length1 = 2 * this.data.length;
    const length2 = this.length + size;
    const newArr = new Uint8Array(length1 > length2 ? length1 : length2);
    newArr.set(this.data);
    this.data = newArr;
  }
};

// libs/utils.ts
function assert(v) {
  if (!v) {
    throw new Error("nullptr");
  }
}

// libs/Attribute.ts
var Attribute = class {
  /**
     * Constructs a new empty attribute.
     *
     * @param type
     * the type of the attribute.
     */
  constructor(type) {
    /**
       * The type of this attribute.
       */
    __publicField(this, "type");
    /**
       * The raw value of this attribute, used only for unknown attributes.
       */
    __publicField(this, "value");
    /**
       * The next attribute in this attribute list. May be <tt>null</tt>.
       */
    __publicField(this, "next", null);
    this.type = type;
  }
  /**
     * Returns <tt>true</tt> if this type of attribute is unknown. The default
     * implementation of this method always returns <tt>true</tt>.
     *
     * @return <tt>true</tt> if this type of attribute is unknown.
     */
  isUnknown() {
    return true;
  }
  /**
     * Returns <tt>true</tt> if this type of attribute is a code attribute.
     *
     * @return <tt>true</tt> if this type of attribute is a code attribute.
     */
  isCodeAttribute() {
    return false;
  }
  /**
     * Returns the labels corresponding to this attribute.
     *
     * @return the labels corresponding to this attribute, or <tt>null</tt> if
     * this attribute is not a code attribute that contains labels.
     */
  getLabels() {
    return null;
  }
  /**
     * Reads a {@link #type type} attribute. This method must return a
     * <i>new</i> {@link Attribute} object, of type {@link #type type},
     * corresponding to the <tt>len</tt> bytes starting at the given offset, in
     * the given class reader.
     *
     * @param cr
     * the class that contains the attribute to be read.
     * @param off
     * index of the first byte of the attribute's content in
     * {@link ClassReader#b cr.b}. The 6 attribute header bytes,
     * containing the type and the length of the attribute, are not
     * taken into account here.
     * @param len
     * the length of the attribute's content.
     * @param buf
     * buffer to be used to call {@link ClassReader#readUTF8
     * readUTF8}, {@link ClassReader#readClass(int,char[]) readClass}
     * or {@link ClassReader#readConst readConst}.
     * @param codeOff
     * index of the first byte of code's attribute content in
     * {@link ClassReader#b cr.b}, or -1 if the attribute to be read
     * is not a code attribute. The 6 attribute header bytes,
     * containing the type and the length of the attribute, are not
     * taken into account here.
     * @param labels
     * the labels of the method's code, or <tt>null</tt> if the
     * attribute to be read is not a code attribute.
     * @return a <i>new</i> {@link Attribute} object corresponding to the given
     * bytes.
     */
  read(cr, off, len, buf, codeOff, labels) {
    const attr = new Attribute(this.type);
    attr.value = cr.buf.slice(0, len);
    return attr;
  }
  /**
     * Returns the byte array form of this attribute.
     *
     * @param cw
     * the class to which this attribute must be added. This
     * parameter can be used to add to the constant pool of this
     * class the items that corresponds to this attribute.
     * @param code
     * the bytecode of the method corresponding to this code
     * attribute, or <tt>null</tt> if this attribute is not a code
     * attributes.
     * @param len
     * the length of the bytecode of the method corresponding to this
     * code attribute, or <tt>null</tt> if this attribute is not a
     * code attribute.
     * @param maxStack
     * the maximum stack size of the method corresponding to this
     * code attribute, or -1 if this attribute is not a code
     * attribute.
     * @param maxLocals
     * the maximum number of local variables of the method
     * corresponding to this code attribute, or -1 if this attribute
     * is not a code attribute.
     * @return the byte array form of this attribute.
     */
  write(cw, code, len, maxStack, maxLocals) {
    const v = new ByteVector();
    v.data = this.value;
    v.length = this.value.length;
    return v;
  }
  /**
     * Returns the length of the attribute list that begins with this attribute.
     *
     * @return the length of the attribute list that begins with this attribute.
     */
  getCount() {
    let count = 0;
    let attr = this;
    while (attr != null) {
      count += 1;
      attr = attr.next;
    }
    return count;
  }
  /**
     * Returns the size of all the attributes in this attribute list.
     *
     * @param cw
     * the class writer to be used to convert the attributes into
     * byte arrays, with the {@link #write write} method.
     * @param code
     * the bytecode of the method corresponding to these code
     * attributes, or <tt>null</tt> if these attributes are not code
     * attributes.
     * @param len
     * the length of the bytecode of the method corresponding to
     * these code attributes, or <tt>null</tt> if these attributes
     * are not code attributes.
     * @param maxStack
     * the maximum stack size of the method corresponding to these
     * code attributes, or -1 if these attributes are not code
     * attributes.
     * @param maxLocals
     * the maximum number of local variables of the method
     * corresponding to these code attributes, or -1 if these
     * attributes are not code attributes.
     * @return the size of all the attributes in this attribute list. This size
     * includes the size of the attribute headers.
     */
  getSize(cw, code, len, maxStack, maxLocals) {
    let attr = this;
    let size = 0;
    while (attr != null) {
      assert(attr.type);
      cw.newUTF8(attr.type);
      size += attr.write(cw, code, len, maxStack, maxLocals).length + 6;
      attr = attr.next;
    }
    return size;
  }
  /**
     * Writes all the attributes of this attribute list in the given byte
     * vector.
     *
     * @param cw
     * the class writer to be used to convert the attributes into
     * byte arrays, with the {@link #write write} method.
     * @param code
     * the bytecode of the method corresponding to these code
     * attributes, or <tt>null</tt> if these attributes are not code
     * attributes.
     * @param len
     * the length of the bytecode of the method corresponding to
     * these code attributes, or <tt>null</tt> if these attributes
     * are not code attributes.
     * @param maxStack
     * the maximum stack size of the method corresponding to these
     * code attributes, or -1 if these attributes are not code
     * attributes.
     * @param maxLocals
     * the maximum number of local variables of the method
     * corresponding to these code attributes, or -1 if these
     * attributes are not code attributes.
     * @param out
     * where the attributes must be written.
     */
  put(cw, code, len, maxStack, maxLocals, out) {
    let attr = this;
    while (attr != null) {
      const b = attr.write(cw, code, len, maxStack, maxLocals);
      assert(attr.type);
      out.putShort(cw.newUTF8(attr.type)).putInt(b.length);
      out.putByteArray(b.data, 0, b.length);
      attr = attr.next;
    }
  }
};

// libs/Type.ts
var _Type = class {
  /**
     * Constructs a reference type.
     *
     * @param sort the sort of the reference type to be constructed.
     * @param buf  a buffer containing the descriptor of the previous type.
     * @param off  the offset of this descriptor in the previous buffer.
     * @param len  the length of this descriptor.
     */
  constructor(sort, buf, off, len) {
    /**
       * The sort of this Java type.
       *
       * {@link #VOID VOID}, {@link #BOOLEAN BOOLEAN}, {@link #CHAR CHAR},
       * {@link #BYTE BYTE}, {@link #SHORT SHORT}, {@link #INT INT},
       * {@link #FLOAT FLOAT}, {@link #LONG LONG}, {@link #DOUBLE DOUBLE},
       * {@link #ARRAY ARRAY}, {@link #OBJECT OBJECT} or {@link #METHOD
       * METHOD}.
       */
    __publicField(this, "sort");
    /**
       * A buffer containing the internal name of this Java type. This field is
       * only used for reference types.
       */
    __publicField(this, "buf");
    /**
       * The offset of the internal name of this Java type in {@link #buf buf} or,
       * for primitive types, the size, descriptor and getOpcode offsets for this
       * type (byte 0 contains the size, byte 1 the descriptor, byte 2 the offset
       * for IALOAD or IASTORE, byte 3 the offset for all other instructions).
       */
    __publicField(this, "off");
    /**
       * The length of the internal name of this Java type.
       */
    __publicField(this, "len");
    this.sort = 0;
    this.off = 0;
    this.len = 0;
    this.sort = sort;
    this.buf = buf ?? "";
    this.off = off;
    this.len = len;
  }
  /**
     * Returns the Java type corresponding to the given internal name.
     *
     * @param internalName an internal name.
     * @return the Java type corresponding to the given internal name.
     */
  static getObjectType(internalName) {
    return new _Type(internalName[0] === "[" ? _Type.ARRAY : _Type.OBJECT, internalName, 0, internalName.length);
  }
  /**
     * Returns the Java type corresponding to the given method descriptor.
     * Equivalent to <code>Type.getType(methodDescriptor)</code>.
     *
     * @param methodDescriptor a method descriptor.
     * @return the Java type corresponding to the given method descriptor.
     */
  static getMethodType(methodDescriptor) {
    return _Type.getType(methodDescriptor, 0);
  }
  /**
     * Returns the Java types corresponding to the argument types of the given
     * method descriptor.
     *
     * @param methodDescriptor a method descriptor.
     * @return the Java types corresponding to the argument types of the given
     * method descriptor.
     */
  static getArgumentTypes(methodDescriptor) {
    let off = 1;
    let size = 0;
    while (true) {
      const car = methodDescriptor[off++];
      if (car === ")") {
        break;
      } else if (car === "L") {
        while (methodDescriptor[off++] !== ";") {
        }
        ++size;
      } else if (car !== "[") {
        ++size;
      }
    }
    const args = new Array(size);
    off = 1;
    size = 0;
    while (methodDescriptor[off] !== ")") {
      args[size] = _Type.getType(methodDescriptor, off);
      off += args[size].len + (args[size].sort === _Type.OBJECT ? 2 : 0);
      size += 1;
    }
    return args;
  }
  /**
     * Computes the size of the arguments and of the return value of a method.
     *
     * @param desc the descriptor of a method.
     * @return the size of the arguments of the method (plus one for the
     * implicit this argument), argSize, and the size of its return
     * value, retSize, packed into a single int i =
     * <tt>(argSize &lt;&lt; 2) | retSize</tt> (argSize is therefore equal to
     * <tt>i &gt;&gt; 2</tt>, and retSize to <tt>i &amp; 0x03</tt>).
     */
  static getArgumentsAndReturnSizes(desc) {
    let n = 1;
    let c = 1;
    while (true) {
      let car = desc.charAt(c++);
      if (car === ")") {
        car = desc.charAt(c);
        return n << 2 | (car === "V" ? 0 : car === "D" || car === "J" ? 2 : 1);
      } else if (car === "L") {
        while (desc.charAt(c++) !== ";") {
        }
        n += 1;
      } else if (car === "[") {
        while ((car = desc.charAt(c)) === "[") {
          ++c;
        }
        if (car === "D" || car === "J") {
          n -= 1;
        }
      } else if (car === "D" || car === "J") {
        n += 2;
      } else {
        n += 1;
      }
    }
    return 0;
  }
  /**
     * Returns the Java type corresponding to the given type descriptor. For
     * method descriptors, buf is supposed to contain nothing more than the
     * descriptor itself.
     *
     * @param buf a buffer containing a type descriptor.
     * @param off the offset of this descriptor in the previous buffer.
     * @return the Java type corresponding to the given type descriptor.
     */
  static getType(str, off = 0) {
    let len;
    const buf = "".concat(str);
    switch (buf[off]) {
      case "V":
        return _Type.VOID_TYPE;
      case "Z":
        return _Type.BOOLEAN_TYPE;
      case "C":
        return _Type.CHAR_TYPE;
      case "B":
        return _Type.BYTE_TYPE;
      case "S":
        return _Type.SHORT_TYPE;
      case "I":
        return _Type.INT_TYPE;
      case "F":
        return _Type.FLOAT_TYPE;
      case "J":
        return _Type.LONG_TYPE;
      case "D":
        return _Type.DOUBLE_TYPE;
      case "[":
        len = 1;
        while (buf[off + len] === "[") {
          ++len;
        }
        if (buf[off + len] === "L") {
          ++len;
          while (buf[off + len] !== ";") {
            ++len;
          }
        }
        return new _Type(_Type.ARRAY, buf, off, len + 1);
      case "L":
        len = 1;
        while (buf[off + len] !== ";") {
          ++len;
        }
        return new _Type(_Type.OBJECT, buf, off + 1, len - 1);
      default:
        return new _Type(_Type.METHOD, buf, off, buf.length - off);
    }
  }
  /**
       * Returns the internal name of the class corresponding to this object or
       * array type. The internal name of a class is its fully qualified name (as
       * returned by Class.getName(), where '.' are replaced by '/'. This method
       * should only be used for an object or array type.
       *
       * @return the internal name of the class corresponding to this object type.
       */
  get internalName() {
    return this.buf.substr(this.off, this.len);
  }
  /**
     * Appends the descriptor corresponding to this Java type to the given
     * string buffer.
     *
     * @param buf the string buffer to which the descriptor must be appended.
     */
  getDescriptor(buf = "") {
    if (this.sort == _Type.OBJECT) {
      buf += "L";
      for (let i = 0; i < this.len; i++) {
        buf += this.buf[i + this.off];
      }
      buf += ";";
    } else {
      for (let i = 0; i < this.len; i++) {
        buf += this.buf[i + this.off];
      }
    }
  }
  /**
        * Returns the size of values of this type. This method must not be used for
        * method types.
        *
        * @return the size of values of this type, i.e., 2 for <tt>long</tt> and
        * <tt>double</tt>, 0 for <tt>void</tt> and 1 otherwise.
        */
  get size() {
    return this.buf == null ? this.off & 255 : 1;
  }
  /**
     * Tests if the given object is equal to this type.
     *
     * @param o the object to be compared to this type.
     * @return <tt>true</tt> if the given object is equal to this type.
     */
  equals(o) {
    if (this === o) {
      return true;
    }
    if (!(o != null && o instanceof _Type)) {
      return false;
    }
    const t = o;
    if (this.sort !== t.sort) {
      return false;
    }
    if (this.sort >= _Type.ARRAY) {
      if (this.len !== t.len) {
        return false;
      }
      for (let i = this.off, j = t.off, end = i + this.len; i < end; i++, j++) {
        if (this.buf[i] !== t.buf[j]) {
          return false;
        }
      }
    }
    return true;
  }
  /**
     * Returns a hash code value for this type.
     *
     * @return a hash code value for this type.
     */
  hashCode() {
    let hc = 13 * this.sort;
    if (this.sort >= _Type.ARRAY) {
      for (let i = this.off, end = i + this.len; i < end; i++) {
        hc = 17 * (hc + this.buf[i].charCodeAt(0));
      }
    }
    return hc;
  }
  /**
     * Returns a string representation of this type.
     *
     * @return the descriptor of this type.
     */
  toString() {
    return this.getDescriptor();
  }
};
var Type = _Type;
/**
  * The sort of the <tt>void</tt> type. See {@link #getSort getSort}.
  */
__publicField(Type, "VOID", 0);
/**
   * The sort of the <tt>boolean</tt> type. See {@link #getSort getSort}.
   */
__publicField(Type, "BOOLEAN", 1);
/**
   * The sort of the <tt>char</tt> type. See {@link #getSort getSort}.
   */
__publicField(Type, "CHAR", 2);
/**
   * The sort of the <tt>byte</tt> type. See {@link #getSort getSort}.
   */
__publicField(Type, "BYTE", 3);
/**
   * The sort of the <tt>short</tt> type. See {@link #getSort getSort}.
   */
__publicField(Type, "SHORT", 4);
/**
   * The sort of the <tt>int</tt> type. See {@link #getSort getSort}.
   */
__publicField(Type, "INT", 5);
/**
   * The sort of the <tt>float</tt> type. See {@link #getSort getSort}.
   */
__publicField(Type, "FLOAT", 6);
/**
   * The sort of the <tt>long</tt> type. See {@link #getSort getSort}.
   */
__publicField(Type, "LONG", 7);
/**
   * The sort of the <tt>double</tt> type. See {@link #getSort getSort}.
   */
__publicField(Type, "DOUBLE", 8);
/**
   * The sort of array reference types. See {@link #getSort getSort}.
   */
__publicField(Type, "ARRAY", 9);
/**
   * The sort of object reference types. See {@link #getSort getSort}.
   */
__publicField(Type, "OBJECT", 10);
/**
   * The sort of method types. See {@link #getSort getSort}.
   */
__publicField(Type, "METHOD", 11);
/**
   * The <tt>void</tt> type.
   */
__publicField(Type, "VOID_TYPE", new _Type(_Type.VOID, null, "V".charCodeAt(0) << 24 | 5 << 16, 1));
/**
   * The <tt>boolean</tt> type.
   */
__publicField(Type, "BOOLEAN_TYPE", new _Type(_Type.BOOLEAN, null, "Z".charCodeAt(0) << 24 | 5 << 8 | 1, 1));
/**
   * The <tt>char</tt> type.
   */
__publicField(Type, "CHAR_TYPE", new _Type(_Type.CHAR, null, "C".charCodeAt(0) << 24 | 6 << 8 | 1, 1));
/**
   * The <tt>byte</tt> type.
   */
__publicField(Type, "BYTE_TYPE", new _Type(_Type.BYTE, null, "B".charCodeAt(0) << 24 | 5 << 8 | 1, 1));
/**
   * The <tt>short</tt> type.
   */
__publicField(Type, "SHORT_TYPE", new _Type(_Type.SHORT, null, "S".charCodeAt(0) << 24 | 7 << 8 | 1, 1));
/**
   * The <tt>int</tt> type.
   */
__publicField(Type, "INT_TYPE", new _Type(_Type.INT, null, "I".charCodeAt(0) << 24 | 1, 1));
/**
   * The <tt>float</tt> type.
   */
__publicField(Type, "FLOAT_TYPE", new _Type(_Type.FLOAT, null, "F".charCodeAt(0) << 24 | 2 << 16 | 2 << 8 | 1, 1));
/**
   * The <tt>long</tt> type.
   */
__publicField(Type, "LONG_TYPE", new _Type(_Type.LONG, null, "J".charCodeAt(0) << 24 | 1 << 16 | 1 << 8 | 2, 1));
/**
   * The <tt>double</tt> type.
   */
__publicField(Type, "DOUBLE_TYPE", new _Type(_Type.DOUBLE, null, "D".charCodeAt(0) << 24 | 3 << 16 | 3 << 8 | 2, 1));

// libs/AnnotationWriter.ts
var AnnotationWriter = class extends AnnotationVisitor {
  /**
     * Constructs a new {@link AnnotationWriter}.
     *
     * @param cw
     * the class writer to which this annotation must be added.
     * @param named
     * <tt>true<tt> if values are named, <tt>false</tt> otherwise.
     * @param bv
     * where the annotation values must be stored.
     * @param parent
     * where the number of annotation values must be stored.
     * @param offset
     * where in <tt>parent</tt> the number of annotation values must
     * be stored.
     */
  constructor(cw, named, bv, parent = null, offset) {
    super(327680 /* ASM5 */);
    /**
       * The class writer TO which this annotation must be added.
       */
    __publicField(this, "cw");
    /**
       * The number of values in this annotation.
       */
    __publicField(this, "size");
    /**
       * <tt>true<tt> if values are named, <tt>false</tt> otherwise. Annotation
       * writers used for annotation default and annotation arrays use unnamed
       * values.
       */
    __publicField(this, "named");
    /**
       * The annotation values in bytecode form. This byte vector only contains
       * the values themselves, i.e. the number of values must be stored as a
       * unsigned short just before these bytes.
       */
    __publicField(this, "bv");
    /**
       * The byte vector to be used to store the number of values of this
       * annotation. See {@link #bv}.
       */
    __publicField(this, "parent");
    /**
       * Where the number of values of this annotation must be stored in
       * {@link #parent}.
       */
    __publicField(this, "offset");
    /**
       * Next annotation writer. This field is used to store annotation lists.
       */
    __publicField(this, "next", null);
    /**
       * Previous annotation writer. This field is used to store annotation lists.
       */
    __publicField(this, "prev", null);
    this.size = 0;
    this.named = false;
    this.offset = 0;
    this.cw = cw;
    this.named = named;
    this.bv = bv;
    this.parent = parent;
    this.offset = offset;
  }
  visit(name, value) {
    ++this.size;
    if (this.named) {
      this.bv.putShort(this.cw.newUTF8(name));
    }
    if (typeof value === "string") {
      this.bv.put12("s".charCodeAt(0), this.cw.newUTF8(value));
    } else if (typeof value === "number") {
      this.bv.put12("B".charCodeAt(0), this.cw.newInteger(value).index);
    } else if (typeof value === "boolean") {
      const v = value ? 1 : 0;
      this.bv.put12("Z".charCodeAt(0), this.cw.newInteger(v).index);
    } else if (typeof value === "string") {
      this.bv.put12("C".charCodeAt(0), this.cw.newInteger(value.charCodeAt(0)).index);
    } else if (typeof value === "number") {
      this.bv.put12("S".charCodeAt(0), this.cw.newInteger(value).index);
    } else if (value != null && value instanceof Type) {
      this.bv.put12("c".charCodeAt(0), this.cw.newUTF8(value.getDescriptor()));
    } else if (value != null && value instanceof Array) {
      const v = value;
      this.bv.put12("[".charCodeAt(0), v.length);
      for (let i = 0; i < v.length; i++) {
        this.bv.put12("B".charCodeAt(0), this.cw.newInteger(v[i]).index);
      }
    } else if (value != null && value instanceof Array) {
      const v = value;
      this.bv.put12("[".charCodeAt(0), v.length);
      for (let i = 0; i < v.length; i++) {
        this.bv.put12("Z".charCodeAt(0), this.cw.newInteger(v[i] ? 1 : 0).index);
      }
    } else if (value != null && value instanceof Array) {
      const v = value;
      this.bv.put12("[".charCodeAt(0), v.length);
      for (let i = 0; i < v.length; i++) {
        this.bv.put12("S".charCodeAt(0), this.cw.newInteger(v[i]).index);
      }
    } else if (value != null && value instanceof Array) {
      const v = value;
      this.bv.put12("[".charCodeAt(0), v.length);
      for (let i = 0; i < v.length; i++) {
        this.bv.put12("C".charCodeAt(0), this.cw.newInteger(v[i].charCodeAt(0)).index);
      }
    } else if (value != null && value instanceof Array) {
      const v = value;
      this.bv.put12("[".charCodeAt(0), v.length);
      for (let i = 0; i < v.length; i++) {
        this.bv.put12("I".charCodeAt(0), this.cw.newInteger(v[i]).index);
      }
    } else if (value != null && value instanceof Array) {
      const v = value;
      this.bv.put12("[".charCodeAt(0), v.length);
      for (let i = 0; i < v.length; i++) {
      }
    } else if (value != null && value instanceof Array) {
      const v = value;
      this.bv.put12("[".charCodeAt(0), v.length);
      for (let i = 0; i < v.length; i++) {
        this.bv.put12("F".charCodeAt(0), this.cw.newFloat(v[i]).index);
      }
    } else if (value != null && value instanceof Array) {
      const v = value;
      this.bv.put12("[".charCodeAt(0), v.length);
      for (let i = 0; i < v.length; i++) {
        this.bv.put12("D".charCodeAt(0), this.cw.newDouble(v[i]).index);
      }
    } else {
      const i = this.cw.newConstItem(value);
      this.bv.put12(".s.IFJDCS".charAt(i.type).charCodeAt(0), i.index);
    }
  }
  visitEnum(name, desc, value) {
    ++this.size;
    if (this.named) {
      this.bv.putShort(this.cw.newUTF8(name));
    }
    this.bv.put12("e".charCodeAt(0), this.cw.newUTF8(desc)).putShort(this.cw.newUTF8(value));
  }
  visitAnnotation(name, desc) {
    ++this.size;
    if (this.named) {
      this.bv.putShort(this.cw.newUTF8(name));
    }
    this.bv.put12("@".charCodeAt(0), this.cw.newUTF8(desc)).putShort(0);
    return new AnnotationWriter(this.cw, true, this.bv, this.bv, this.bv.length - 2);
  }
  visitArray(name) {
    ++this.size;
    if (this.named) {
      this.bv.putShort(this.cw.newUTF8(name));
    }
    this.bv.put12("[".charCodeAt(0), 0);
    return new AnnotationWriter(this.cw, false, this.bv, this.bv, this.bv.length - 2);
  }
  visitEnd() {
    if (this.parent != null) {
      const data = this.parent.data;
      data[this.offset] = this.size >>> 8 | 0;
      data[this.offset + 1] = this.size | 0;
    }
  }
  /**
     * Returns the size of this annotation writer list.
     *
     * @return the size of this annotation writer list.
     */
  getSize() {
    let size = 0;
    let aw = this;
    while (aw != null) {
      size += aw.bv.length;
      aw = aw.next;
    }
    return size;
  }
  /**
     * Puts the annotations of this annotation writer list into the given byte
     * vector.
     *
     * @param out
     * where the annotations must be put.
     */
  put(out) {
    let n = 0;
    let size = 2;
    let aw = this;
    let last = null;
    while (aw != null) {
      ++n;
      size += aw.bv.length;
      aw.visitEnd();
      aw.prev = last;
      last = aw;
      aw = aw.next;
    }
    out.putInt(size);
    out.putShort(n);
    aw = last;
    while (aw != null) {
      out.putByteArray(aw.bv.data, 0, aw.bv.length);
      aw = aw.prev;
    }
  }
  /**
     * Puts the given annotation lists into the given byte vector.
     *
     * @param panns
     * an array of annotation writer lists.
     * @param off
     * index of the first annotation to be written.
     * @param out
     * where the annotations must be put.
     */
  static put(panns, off, out) {
    let size = 1 + 2 * (panns.length - off);
    for (let i = off; i < panns.length; ++i) {
      size += panns[i] == null ? 0 : panns[i].getSize();
    }
    out.putInt(size).putByte(panns.length - off);
    for (let i = off; i < panns.length; ++i) {
      let aw = panns[i];
      let last = null;
      let n = 0;
      while (aw != null) {
        ++n;
        aw.visitEnd();
        aw.prev = last;
        last = aw;
        aw = aw.next;
      }
      out.putShort(n);
      aw = last;
      while (aw != null) {
        out.putByteArray(aw.bv.data, 0, aw.bv.length);
        aw = aw.prev;
      }
    }
  }
  /**
     * Puts the given type reference and type path into the given bytevector.
     * LOCAL_VARIABLE and RESOURCE_VARIABLE target types are not supported.
     *
     * @param typeRef
     * a reference to the annotated type. See {@link TypeReference}.
     * @param typePath
     * the path to the annotated type argument, wildcard bound, array
     * element type, or static inner type within 'typeRef'. May be
     * <tt>null</tt> if the annotation targets 'typeRef' as a whole.
     * @param out
     * where the type reference and type path must be put.
     */
  static putTarget(typeRef, typePath, out) {
    switch (typeRef >>> 24) {
      case 0:
      case 1:
      case 22:
        out.putShort(typeRef >>> 16);
        break;
      case 19:
      case 20:
      case 21:
        out.putByte(typeRef >>> 24);
        break;
      case 71:
      case 72:
      case 73:
      case 74:
      case 75:
        out.putInt(typeRef);
        break;
      default:
        out.put12(typeRef >>> 24, (typeRef & 16776960) >> 8);
        break;
    }
    if (typePath == null) {
      out.putByte(0);
    } else {
      const length = typePath.buf[typePath.offset] * 2 + 1;
      out.putByteArray(typePath.buf, typePath.offset, length);
    }
  }
};

// libs/ClassVisitor.ts
var ClassVisitor = class {
  /**
     * Constructs a new {@link ClassVisitor}.
     *
     * @param api
     * the ASM API version implemented by this visitor. Must be one
     * of {@link Opcodes#ASM4} or {@link Opcodes#ASM5}.
     * @param cv
     * the class visitor to which this visitor must delegate method
     * calls. May be null.
     */
  constructor(api, cv = null) {
    /**
       * The ASM API version implemented by this visitor. The value of this field
       * must be one of {@link Opcodes#ASM4} or {@link Opcodes#ASM5}.
       */
    __publicField(this, "api");
    /**
       * The class visitor to which this visitor must delegate method calls. May
       * be null.
       */
    __publicField(this, "cv");
    this.api = 0;
    if (api !== 262144 /* ASM4 */ && api !== 327680 /* ASM5 */) {
      throw new Error();
    }
    this.api = api;
    this.cv = cv;
  }
  /**
     * Visits the header of the class.
     *
     * @param version
     * the class version.
     * @param access
     * the class's access flags (see {@link Opcodes}). This parameter
     * also indicates if the class is deprecated.
     * @param name
     * the internal name of the class (see
     * {@link Type#getInternalName() getInternalName}).
     * @param signature
     * the signature of this class. May be <tt>null</tt> if the class
     * is not a generic one, and does not extend or implement generic
     * classes or interfaces.
     * @param superName
     * the internal of name of the super class (see
     * {@link Type#getInternalName() getInternalName}). For
     * interfaces, the super class is {@link Object}. May be
     * <tt>null</tt>, but only for the {@link Object} class.
     * @param interfaces
     * the internal names of the class's interfaces (see
     * {@link Type#getInternalName() getInternalName}). May be
     * <tt>null</tt>.
     */
  visit(version, access, name, signature, superName, interfaces) {
    if (this.cv != null) {
      this.cv.visit(version, access, name, signature, superName, interfaces);
    }
  }
  /**
     * Visits the source of the class.
     *
     * @param source
     * the name of the source file from which the class was compiled.
     * May be <tt>null</tt>.
     * @param debug
     * additional debug information to compute the correspondance
     * between source and compiled elements of the class. May be
     * <tt>null</tt>.
     */
  visitSource(source, debug) {
    if (this.cv != null) {
      this.cv.visitSource(source, debug);
    }
  }
  /**
     * Visits the enclosing class of the class. This method must be called only
     * if the class has an enclosing class.
     *
     * @param owner
     * internal name of the enclosing class of the class.
     * @param name
     * the name of the method that contains the class, or
     * <tt>null</tt> if the class is not enclosed in a method of its
     * enclosing class.
     * @param desc
     * the descriptor of the method that contains the class, or
     * <tt>null</tt> if the class is not enclosed in a method of its
     * enclosing class.
     */
  visitOuterClass(owner, name, desc) {
    if (this.cv != null) {
      this.cv.visitOuterClass(owner, name, desc);
    }
  }
  /**
     * Visits an annotation of the class.
     *
     * @param desc
     * the class descriptor of the annotation class.
     * @param visible
     * <tt>true</tt> if the annotation is visible at runtime.
     * @return a visitor to visit the annotation values, or <tt>null</tt> if
     * this visitor is not interested in visiting this annotation.
     */
  visitAnnotation(desc, visible) {
    if (this.cv != null) {
      return this.cv.visitAnnotation(desc, visible);
    }
    return null;
  }
  /**
     * Visits an annotation on a type in the class signature.
     *
     * @param typeRef
     * a reference to the annotated type. The sort of this type
     * reference must be {@link TypeReference#CLASS_TYPE_PARAMETER
     * CLASS_TYPE_PARAMETER},
     * {@link TypeReference#CLASS_TYPE_PARAMETER_BOUND
     * CLASS_TYPE_PARAMETER_BOUND} or
     * {@link TypeReference#CLASS_EXTENDS CLASS_EXTENDS}. See
     * {@link TypeReference}.
     * @param typePath
     * the path to the annotated type argument, wildcard bound, array
     * element type, or static inner type within 'typeRef'. May be
     * <tt>null</tt> if the annotation targets 'typeRef' as a whole.
     * @param desc
     * the class descriptor of the annotation class.
     * @param visible
     * <tt>true</tt> if the annotation is visible at runtime.
     * @return a visitor to visit the annotation values, or <tt>null</tt> if
     * this visitor is not interested in visiting this annotation.
     */
  visitTypeAnnotation(typeRef, typePath, desc, visible) {
    if (this.api < 327680 /* ASM5 */) {
      throw new Error();
    }
    if (this.cv != null) {
      return this.cv.visitTypeAnnotation(typeRef, typePath, desc, visible);
    }
    return null;
  }
  /**
     * Visits a non standard attribute of the class.
     *
     * @param attr
     * an attribute.
     */
  visitAttribute(attr) {
    if (this.cv != null) {
      this.cv.visitAttribute(attr);
    }
  }
  /**
     * Visits information about an inner class. This inner class is not
     * necessarily a member of the class being visited.
     *
     * @param name
     * the internal name of an inner class (see
     * {@link Type#getInternalName() getInternalName}).
     * @param outerName
     * the internal name of the class to which the inner class
     * belongs (see {@link Type#getInternalName() getInternalName}).
     * May be <tt>null</tt> for not member classes.
     * @param innerName
     * the (simple) name of the inner class inside its enclosing
     * class. May be <tt>null</tt> for anonymous inner classes.
     * @param access
     * the access flags of the inner class as originally declared in
     * the enclosing class.
     */
  visitInnerClass(name, outerName, innerName, access) {
    if (this.cv != null) {
      this.cv.visitInnerClass(name, outerName, innerName, access);
    }
  }
  /**
     * Visits a field of the class.
     *
     * @param access
     * the field's access flags (see {@link Opcodes}). This parameter
     * also indicates if the field is synthetic and/or deprecated.
     * @param name
     * the field's name.
     * @param desc
     * the field's descriptor (see {@link Type Type}).
     * @param signature
     * the field's signature. May be <tt>null</tt> if the field's
     * type does not use generic types.
     * @param value
     * the field's initial value. This parameter, which may be
     * <tt>null</tt> if the field does not have an initial value,
     * must be an {@link Integer}, a {@link Float}, a {@link Long}, a
     * {@link Double} or a {@link String} (for <tt>int</tt>,
     * <tt>float</tt>, <tt>long</tt> or <tt>String</tt> fields
     * respectively). <i>This parameter is only used for static
     * fields</i>. Its value is ignored for non static fields, which
     * must be initialized through bytecode instructions in
     * constructors or methods.
     * @return a visitor to visit field annotations and attributes, or
     * <tt>null</tt> if this class visitor is not interested in visiting
     * these annotations and attributes.
     */
  visitField(access, name, desc, signature, value) {
    if (this.cv != null) {
      return this.cv.visitField(access, name, desc, signature, value);
    }
    return null;
  }
  /**
     * Visits a method of the class. This method <i>must</i> return a new
     * {@link MethodVisitor} instance (or <tt>null</tt>) each time it is called,
     * i.e., it should not return a previously returned visitor.
     *
     * @param access
     * the method's access flags (see {@link Opcodes}). This
     * parameter also indicates if the method is synthetic and/or
     * deprecated.
     * @param name
     * the method's name.
     * @param desc
     * the method's descriptor (see {@link Type Type}).
     * @param signature
     * the method's signature. May be <tt>null</tt> if the method
     * parameters, return type and exceptions do not use generic
     * types.
     * @param exceptions
     * the internal names of the method's exception classes (see
     * {@link Type#getInternalName() getInternalName}). May be
     * <tt>null</tt>.
     * @return an object to visit the byte code of the method, or <tt>null</tt>
     * if this class visitor is not interested in visiting the code of
     * this method.
     */
  visitMethod(access, name, desc, signature, exceptions) {
    if (this.cv != null) {
      return this.cv.visitMethod(access, name, desc, signature, exceptions);
    }
    return null;
  }
  /**
     * Visits the end of the class. This method, which is the last one to be
     * called, is used to inform the visitor that all the fields and methods of
     * the class have been visited.
     */
  visitEnd() {
    if (this.cv != null) {
      this.cv.visitEnd();
    }
  }
};

// libs/FieldVisitor.ts
var FieldVisitor = class {
  /**
     * Constructs a new {@link FieldVisitor}.
     *
     * @param api
     * the ASM API version implemented by this visitor. Must be one
     * of {@link Opcodes#ASM4} or {@link Opcodes#ASM5}.
     * @param fv
     * the field visitor to which this visitor must delegate method
     * calls. May be null.
     */
  constructor(api, fv = null) {
    /**
       * The ASM API version implemented by this visitor. The value of this field
       * must be one of {@link Opcodes#ASM4} or {@link Opcodes#ASM5}.
       */
    __publicField(this, "api");
    /**
       * The field visitor to which this visitor must delegate method calls. May
       * be null.
       */
    __publicField(this, "fv");
    this.api = 0;
    if (api !== 262144 /* ASM4 */ && api !== 327680 /* ASM5 */) {
      throw new Error();
    }
    this.api = api;
    this.fv = fv;
  }
  /**
     * Visits an annotation of the field.
     *
     * @param desc
     * the class descriptor of the annotation class.
     * @param visible
     * <tt>true</tt> if the annotation is visible at runtime.
     * @return a visitor to visit the annotation values, or <tt>null</tt> if
     * this visitor is not interested in visiting this annotation.
     */
  visitAnnotation(desc, visible) {
    if (this.fv != null) {
      return this.fv.visitAnnotation(desc, visible);
    }
    return null;
  }
  /**
     * Visits an annotation on the type of the field.
     *
     * @param typeRef
     * a reference to the annotated type. The sort of this type
     * reference must be {@link TypeReference#FIELD FIELD}. See
     * {@link TypeReference}.
     * @param typePath
     * the path to the annotated type argument, wildcard bound, array
     * element type, or static inner type within 'typeRef'. May be
     * <tt>null</tt> if the annotation targets 'typeRef' as a whole.
     * @param desc
     * the class descriptor of the annotation class.
     * @param visible
     * <tt>true</tt> if the annotation is visible at runtime.
     * @return a visitor to visit the annotation values, or <tt>null</tt> if
     * this visitor is not interested in visiting this annotation.
     */
  visitTypeAnnotation(typeRef, typePath, desc, visible) {
    if (this.api < 327680 /* ASM5 */) {
      throw new Error();
    }
    if (this.fv != null) {
      return this.fv.visitTypeAnnotation(typeRef, typePath, desc, visible);
    }
    return null;
  }
  /**
     * Visits a non standard attribute of the field.
     *
     * @param attr
     * an attribute.
     */
  visitAttribute(attr) {
    if (this.fv != null) {
      this.fv.visitAttribute(attr);
    }
  }
  /**
     * Visits the end of the field. This method, which is the last one to be
     * called, is used to inform the visitor that all the annotations and
     * attributes of the field have been visited.
     */
  visitEnd() {
    if (this.fv != null) {
      this.fv.visitEnd();
    }
  }
};

// libs/FieldWriter.ts
var FieldWriter = class extends FieldVisitor {
  /**
     * Constructs a new {@link FieldWriter}.
     *
     * @param cw
     * the class writer to which this field must be added.
     * @param access
     * the field's access flags (see {@link Opcodes}).
     * @param name
     * the field's name.
     * @param desc
     * the field's descriptor (see {@link Type}).
     * @param signature
     * the field's signature. May be <tt>null</tt>.
     * @param value
     * the field's constant value. May be <tt>null</tt>.
     */
  constructor(cw, access, name, desc, signature, value) {
    super(327680 /* ASM5 */);
    /**
       * The class writer to which this field must be added.
       */
    __publicField(this, "cw");
    /**
       * Access flags of this field.
       */
    __publicField(this, "access");
    /**
       * The index of the constant pool item that contains the name of this
       * method.
       */
    __publicField(this, "name");
    /**
       * The index of the constant pool item that contains the descriptor of this
       * field.
       */
    __publicField(this, "desc");
    /**
       * The index of the constant pool item that contains the signature of this
       * field.
       */
    __publicField(this, "signature");
    /**
       * The index of the constant pool item that contains the constant value of
       * this field.
       */
    __publicField(this, "value");
    /**
       * The runtime visible annotations of this field. May be <tt>null</tt>.
       */
    __publicField(this, "anns");
    /**
       * The runtime invisible annotations of this field. May be <tt>null</tt>.
       */
    __publicField(this, "ianns");
    /**
       * The runtime visible type annotations of this field. May be <tt>null</tt>.
       */
    __publicField(this, "tanns");
    /**
       * The runtime invisible type annotations of this field. May be
       * <tt>null</tt>.
       */
    __publicField(this, "itanns");
    /**
       * The non standard attributes of this field. May be <tt>null</tt>.
       */
    __publicField(this, "attrs");
    this.access = 0;
    this.name = 0;
    this.desc = 0;
    this.signature = 0;
    this.value = 0;
    if (cw.firstField == null) {
      cw.firstField = this;
    } else {
      cw.lastField.fv = this;
    }
    cw.lastField = this;
    this.cw = cw;
    this.access = access;
    this.name = cw.newUTF8(name);
    this.desc = cw.newUTF8(desc);
    if (ClassReader.SIGNATURES && signature != null) {
      this.signature = cw.newUTF8(signature);
    }
    if (value != null) {
      this.value = cw.newConstItem(value).index;
    }
  }
  visitAnnotation(desc, visible) {
    if (!ClassReader.ANNOTATIONS) {
      return null;
    }
    const bv = new ByteVector();
    bv.putShort(this.cw.newUTF8(desc)).putShort(0);
    const aw = new AnnotationWriter(this.cw, true, bv, bv, 2);
    if (visible) {
      aw.next = this.anns;
      this.anns = aw;
    } else {
      aw.next = this.ianns;
      this.ianns = aw;
    }
    return aw;
  }
  visitTypeAnnotation(typeRef, typePath, desc, visible) {
    if (!ClassReader.ANNOTATIONS) {
      return null;
    }
    const bv = new ByteVector();
    AnnotationWriter.putTarget(typeRef, typePath, bv);
    bv.putShort(this.cw.newUTF8(desc)).putShort(0);
    const aw = new AnnotationWriter(this.cw, true, bv, bv, bv.length - 2);
    if (visible) {
      aw.next = this.tanns;
      this.tanns = aw;
    } else {
      aw.next = this.itanns;
      this.itanns = aw;
    }
    return aw;
  }
  visitAttribute(attr) {
    attr.next = this.attrs;
    this.attrs = attr;
  }
  visitEnd() {
  }
  /**
     * Returns the size of this field.
     *
     * @return the size of this field.
     */
  getSize() {
    let size = 8;
    if (this.value !== 0) {
      this.cw.newUTF8("ConstantValue");
      size += 8;
    }
    if ((this.access & 4096 /* ACC_SYNTHETIC */) !== 0) {
      if ((this.cw.version & 65535) < 49 /* V1_5 */ || (this.access & ClassWriter.ACC_SYNTHETIC_ATTRIBUTE) !== 0) {
        this.cw.newUTF8("Synthetic");
        size += 6;
      }
    }
    if ((this.access & 131072 /* ACC_DEPRECATED */) !== 0) {
      this.cw.newUTF8("Deprecated");
      size += 6;
    }
    if (ClassReader.SIGNATURES && this.signature !== 0) {
      this.cw.newUTF8("Signature");
      size += 8;
    }
    if (ClassReader.ANNOTATIONS && this.anns != null) {
      this.cw.newUTF8("RuntimeVisibleAnnotations");
      size += 8 + this.anns.getSize();
    }
    if (ClassReader.ANNOTATIONS && this.ianns != null) {
      this.cw.newUTF8("RuntimeInvisibleAnnotations");
      size += 8 + this.ianns.getSize();
    }
    if (ClassReader.ANNOTATIONS && this.tanns != null) {
      this.cw.newUTF8("RuntimeVisibleTypeAnnotations");
      size += 8 + this.tanns.getSize();
    }
    if (ClassReader.ANNOTATIONS && this.itanns != null) {
      this.cw.newUTF8("RuntimeInvisibleTypeAnnotations");
      size += 8 + this.itanns.getSize();
    }
    if (this.attrs != null) {
      size += this.attrs.getSize(this.cw, null, 0, -1, -1);
    }
    return size;
  }
  /**
     * Puts the content of this field into the given byte vector.
     *
     * @param out
     * where the content of this field must be put.
     */
  put(out) {
    const FACTOR = ClassWriter.TO_ACC_SYNTHETIC_$LI$();
    const mask = 131072 /* ACC_DEPRECATED */ | ClassWriter.ACC_SYNTHETIC_ATTRIBUTE | ((this.access & ClassWriter.ACC_SYNTHETIC_ATTRIBUTE) / FACTOR | 0);
    out.putShort(this.access & ~mask).putShort(this.name).putShort(this.desc);
    let attributeCount = 0;
    if (this.value !== 0) {
      ++attributeCount;
    }
    if ((this.access & 4096 /* ACC_SYNTHETIC */) !== 0) {
      if ((this.cw.version & 65535) < 49 /* V1_5 */ || (this.access & ClassWriter.ACC_SYNTHETIC_ATTRIBUTE) !== 0) {
        ++attributeCount;
      }
    }
    if ((this.access & 131072 /* ACC_DEPRECATED */) !== 0) {
      ++attributeCount;
    }
    if (ClassReader.SIGNATURES && this.signature !== 0) {
      ++attributeCount;
    }
    if (ClassReader.ANNOTATIONS && this.anns != null) {
      ++attributeCount;
    }
    if (ClassReader.ANNOTATIONS && this.ianns != null) {
      ++attributeCount;
    }
    if (ClassReader.ANNOTATIONS && this.tanns != null) {
      ++attributeCount;
    }
    if (ClassReader.ANNOTATIONS && this.itanns != null) {
      ++attributeCount;
    }
    if (this.attrs != null) {
      attributeCount += this.attrs.getCount();
    }
    out.putShort(attributeCount);
    if (this.value !== 0) {
      out.putShort(this.cw.newUTF8("ConstantValue"));
      out.putInt(2).putShort(this.value);
    }
    if ((this.access & 4096 /* ACC_SYNTHETIC */) !== 0) {
      if ((this.cw.version & 65535) < 49 /* V1_5 */ || (this.access & ClassWriter.ACC_SYNTHETIC_ATTRIBUTE) !== 0) {
        out.putShort(this.cw.newUTF8("Synthetic")).putInt(0);
      }
    }
    if ((this.access & 131072 /* ACC_DEPRECATED */) !== 0) {
      out.putShort(this.cw.newUTF8("Deprecated")).putInt(0);
    }
    if (ClassReader.SIGNATURES && this.signature !== 0) {
      out.putShort(this.cw.newUTF8("Signature"));
      out.putInt(2).putShort(this.signature);
    }
    if (ClassReader.ANNOTATIONS && this.anns != null) {
      out.putShort(this.cw.newUTF8("RuntimeVisibleAnnotations"));
      this.anns.put(out);
    }
    if (ClassReader.ANNOTATIONS && this.ianns != null) {
      out.putShort(this.cw.newUTF8("RuntimeInvisibleAnnotations"));
      this.ianns.put(out);
    }
    if (ClassReader.ANNOTATIONS && this.tanns != null) {
      out.putShort(this.cw.newUTF8("RuntimeVisibleTypeAnnotations"));
      this.tanns.put(out);
    }
    if (ClassReader.ANNOTATIONS && this.itanns != null) {
      out.putShort(this.cw.newUTF8("RuntimeInvisibleTypeAnnotations"));
      this.itanns.put(out);
    }
    if (this.attrs != null) {
      this.attrs.put(this.cw, null, 0, -1, -1, out);
    }
  }
};

// libs/bits.ts
var int8 = new Int8Array(4);
var int32 = new Int32Array(int8.buffer, 0, 1);
var float32 = new Float32Array(int8.buffer, 0, 1);
var SHORT_MIN = -32768;
var SHORT_MAX = 32768;
function intBitsToFloat(bits) {
  int32[0] = bits;
  return float32[0];
}
function floatToIntBits(bits) {
  float32[0] = bits;
  return int32[0];
}
var int16 = new Int16Array(4);
var int64 = new Int32Array(int16.buffer, 0, 2);
var float64 = new Float64Array(int16.buffer, 0, 1);
function longBitsToDouble(bits) {
  int64[0] = Number(bits >> 32n & 0xffffffffn);
  int64[1] = Number(bits & 0xffffffffn);
  return float64[0];
}
function doubleToLongBits(double) {
  float64[0] = double;
  return BigInt(int64[1]) << 32n & BigInt(int64[0]);
}

// libs/Item.ts
var Item = class {
  /**
     * Constructs a copy of the given item.
     *
     * @param index
     * index of the item to be constructed.
     * @param i
     * the item that must be copied into the item to be constructed.
     */
  constructor(index, i) {
    /**
       * Index of this item in the constant pool.
       */
    __publicField(this, "index");
    /**
       * Type of this constant pool item. A single class is used to represent all
       * constant pool item types, in order to minimize the bytecode size of this
       * package. The value of this field is one of {@link ClassWriter#INT},
       * {@link ClassWriter#LONG}, {@link ClassWriter#FLOAT},
       * {@link ClassWriter#DOUBLE}, {@link ClassWriter#UTF8},
       * {@link ClassWriter#STR}, {@link ClassWriter#CLASS},
       * {@link ClassWriter#NAME_TYPE}, {@link ClassWriter#FIELD},
       * {@link ClassWriter#METH}, {@link ClassWriter#IMETH},
       * {@link ClassWriter#MTYPE}, {@link ClassWriter#INDY}.
       *
       * MethodHandle constant 9 variations are stored using a range of 9 values
       * from {@link ClassWriter#HANDLE_BASE} + 1 to
       * {@link ClassWriter#HANDLE_BASE} + 9.
       *
       * Special Item types are used for Items that are stored in the ClassWriter
       * {@link ClassWriter#typeTable}, instead of the constant pool, in order to
       * avoid clashes with normal constant pool items in the ClassWriter constant
       * pool's hash table. These special item types are
       * {@link ClassWriter#TYPE_NORMAL}, {@link ClassWriter#TYPE_UNINIT} and
       * {@link ClassWriter#TYPE_MERGED}.
       */
    __publicField(this, "type");
    /**
       * Value of this item, for an integer item.
       */
    __publicField(this, "intVal", 0);
    /**
       * Value of this item, for a long item.
       */
    __publicField(this, "longVal", 0n);
    /**
       * First part of the value of this item, for items that do not hold a
       * primitive value.
       */
    __publicField(this, "strVal1", "");
    /**
       * Second part of the value of this item, for items that do not hold a
       * primitive value.
       */
    __publicField(this, "strVal2", "");
    /**
       * Third part of the value of this item, for items that do not hold a
       * primitive value.
       */
    __publicField(this, "strVal3", "");
    /**
       * The hash code value of this constant pool item.
       */
    __publicField(this, "__hashCode");
    /**
       * Link to another constant pool item, used for collision lists in the
       * constant pool's hash table.
       */
    __publicField(this, "next", null);
    this.index = index;
    if (i) {
      this.index = index;
      this.type = i.type;
      this.intVal = i.intVal;
      this.longVal = i.longVal;
      this.strVal1 = i.strVal1;
      this.strVal2 = i.strVal2;
      this.strVal3 = i.strVal3;
      this.__hashCode = i.__hashCode;
    }
  }
  /**
     * Sets this item to an integer item.
     *
     * @param intVal
     * the value of this item.
     */
  set$int(intVal) {
    this.type = ClassWriter.INT;
    this.intVal = intVal;
    this.__hashCode = 2147483647 & this.type + intVal;
  }
  /**
     * Sets this item to a long item.
     *
     * @param longVal
     * the value of this item.
     */
  set$long(longVal) {
    this.type = ClassWriter.LONG;
    this.longVal = longVal;
    this.__hashCode = 2147483647 & this.type + Number(longVal & 0xffffffffn);
  }
  /**
     * Sets this item to a float item.
     *
     * @param floatVal
     * the value of this item.
     */
  set$float(floatVal) {
    this.type = ClassWriter.FLOAT;
    this.intVal = floatToIntBits(floatVal);
    this.__hashCode = 2147483647 & this.type + (floatVal | 0);
  }
  /**
     * Sets this item to a double item.
     *
     * @param doubleVal
     * the value of this item.
     */
  set$double(doubleVal) {
    this.type = ClassWriter.DOUBLE;
    this.longVal = doubleToLongBits(doubleVal);
    this.__hashCode = 2147483647 & this.type + (doubleVal | 0);
  }
  /**
     * Sets this item to an item that do not hold a primitive value.
     *
     * @param type
     * the type of this item.
     * @param strVal1
     * first part of the value of this item.
     * @param strVal2
     * second part of the value of this item.
     * @param strVal3
     * third part of the value of this item.
     */
  set(type, strVal1, strVal2, strVal3) {
    this.type = type;
    this.strVal1 = strVal1 ?? "";
    this.strVal2 = strVal2 ?? "";
    this.strVal3 = strVal3 ?? "";
    switch (type) {
      case ClassWriter.CLASS:
        this.intVal = 0;
      case ClassWriter.UTF8:
      case ClassWriter.STR:
      case ClassWriter.MTYPE:
      case ClassWriter.TYPE_NORMAL:
        this.__hashCode = 2147483647 & type + str_hash(this.strVal1);
        return;
      case ClassWriter.NAME_TYPE: {
        this.__hashCode = 2147483647 & type + str_hash(this.strVal1) * str_hash(this.strVal2);
        return;
      }
      default:
        this.__hashCode = 2147483647 & type + str_hash(this.strVal1) * str_hash(this.strVal2) * str_hash(this.strVal3);
    }
  }
  /**
     * Sets the item to an InvokeDynamic item.
     *
     * @param name
     * invokedynamic's name.
     * @param desc
     * invokedynamic's desc.
     * @param bsmIndex
     * zero based index into the class attribute BootrapMethods.
     */
  setInvkDynItem(name, desc, bsmIndex) {
    this.type = ClassWriter.INDY;
    this.longVal = BigInt(bsmIndex);
    this.strVal1 = name;
    this.strVal2 = desc;
    this.__hashCode = 2147483647 & ClassWriter.INDY + bsmIndex * this.strVal1.toString() * this.strVal2.toString();
  }
  /**
     * Sets the item to a BootstrapMethod item.
     *
     * @param position
     * position in byte in the class attribute BootrapMethods.
     * @param hashCode
     * hashcode of the item. This hashcode is processed from the
     * hashcode of the bootstrap method and the hashcode of all
     * bootstrap arguments.
     */
  setPosHash(position, hashCode) {
    this.type = ClassWriter.BSM;
    this.intVal = position;
    this.__hashCode = hashCode;
  }
  /**
     * Indicates if the given item is equal to this one. <i>This method assumes
     * that the two items have the same {@link #type}</i>.
     *
     * @param i
     * the item to be compared to this one. Both items must have the
     * same {@link #type}.
     * @return <tt>true</tt> if the given item if equal to this one,
     * <tt>false</tt> otherwise.
     */
  isEqualTo(i) {
    switch (this.type) {
      case ClassWriter.UTF8:
      case ClassWriter.STR:
      case ClassWriter.CLASS:
      case ClassWriter.MTYPE:
      case ClassWriter.TYPE_NORMAL:
        return i.strVal1 === this.strVal1;
      case ClassWriter.TYPE_MERGED:
      case ClassWriter.LONG:
      case ClassWriter.DOUBLE:
        return i.longVal === this.longVal;
      case ClassWriter.INT:
      case ClassWriter.FLOAT:
        return i.intVal === this.intVal;
      case ClassWriter.TYPE_UNINIT:
        return i.intVal === this.intVal && i.strVal1 === this.strVal1;
      case ClassWriter.NAME_TYPE:
        return i.strVal1 === this.strVal1 && i.strVal2 === this.strVal2;
      case ClassWriter.INDY: {
        return i.longVal === this.longVal && i.strVal1 === this.strVal1 && i.strVal2 === this.strVal2;
      }
      default:
        return i.strVal1 === this.strVal1 && i.strVal2 === this.strVal2 && i.strVal3 === this.strVal3;
    }
  }
};
function str_hash(str) {
  let hash = 0;
  if (str.length === 0) {
    return hash;
  }
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash;
}

// libs/MethodVisitor.ts
var MethodVisitor = class {
  /**
     * Constructs a new {@link MethodVisitor}.
     *
     * @param api
     * the ASM API version implemented by this visitor. Must be one
     * of {@link Opcodes#ASM4} or {@link Opcodes#ASM5}.
     * @param mv
     * the method visitor to which this visitor must delegate method
     * calls. May be null.
     */
  constructor(api, mv = null) {
    /**
       * The ASM API version implemented by this visitor. The value of this field
       * must be one of {@link Opcodes#ASM4} or {@link Opcodes#ASM5}.
       */
    __publicField(this, "api");
    /**
       * The method visitor to which this visitor must delegate method calls. May
       * be null.
       */
    __publicField(this, "mv");
    this.api = 0;
    if (api !== 262144 /* ASM4 */ && api !== 327680 /* ASM5 */) {
      throw new Error();
    }
    this.api = api;
    this.mv = mv;
  }
  /**
     * Visits a parameter of this method.
     *
     * @param name
     * parameter name or null if none is provided.
     * @param access
     * the parameter's access flags, only <tt>ACC_FINAL</tt>,
     * <tt>ACC_SYNTHETIC</tt> or/and <tt>ACC_MANDATED</tt> are
     * allowed (see {@link Opcodes}).
     */
  visitParameter(name, access) {
    if (this.api < 327680 /* ASM5 */) {
      throw new Error();
    }
    if (this.mv != null) {
      this.mv.visitParameter(name, access);
    }
  }
  /**
     * Visits the default value of this annotation interface method.
     *
     * @return a visitor to the visit the actual default value of this
     * annotation interface method, or <tt>null</tt> if this visitor is
     * not interested in visiting this default value. The 'name'
     * parameters passed to the methods of this annotation visitor are
     * ignored. Moreover, exacly one visit method must be called on this
     * annotation visitor, followed by visitEnd.
     */
  visitAnnotationDefault() {
    if (this.mv != null) {
      return this.mv.visitAnnotationDefault();
    }
    return null;
  }
  /**
     * Visits an annotation of this method.
     *
     * @param desc
     * the class descriptor of the annotation class.
     * @param visible
     * <tt>true</tt> if the annotation is visible at runtime.
     * @return a visitor to visit the annotation values, or <tt>null</tt> if
     * this visitor is not interested in visiting this annotation.
     */
  visitAnnotation(desc, visible) {
    if (this.mv != null) {
      return this.mv.visitAnnotation(desc, visible);
    }
    return null;
  }
  /**
     * Visits an annotation on a type in the method signature.
     *
     * @param typeRef
     * a reference to the annotated type. The sort of this type
     * reference must be {@link TypeReference#METHOD_TYPE_PARAMETER
     * METHOD_TYPE_PARAMETER},
     * {@link TypeReference#METHOD_TYPE_PARAMETER_BOUND
     * METHOD_TYPE_PARAMETER_BOUND},
     * {@link TypeReference#METHOD_RETURN METHOD_RETURN},
     * {@link TypeReference#METHOD_RECEIVER METHOD_RECEIVER},
     * {@link TypeReference#METHOD_FORMAL_PARAMETER
     * METHOD_FORMAL_PARAMETER} or {@link TypeReference#THROWS
     * THROWS}. See {@link TypeReference}.
     * @param typePath
     * the path to the annotated type argument, wildcard bound, array
     * element type, or static inner type within 'typeRef'. May be
     * <tt>null</tt> if the annotation targets 'typeRef' as a whole.
     * @param desc
     * the class descriptor of the annotation class.
     * @param visible
     * <tt>true</tt> if the annotation is visible at runtime.
     * @return a visitor to visit the annotation values, or <tt>null</tt> if
     * this visitor is not interested in visiting this annotation.
     */
  visitTypeAnnotation(typeRef, typePath, desc, visible) {
    if (this.api < 327680 /* ASM5 */) {
      throw new Error();
    }
    if (this.mv != null) {
      return this.mv.visitTypeAnnotation(typeRef, typePath, desc, visible);
    }
    return null;
  }
  /**
     * Visits an annotation of a parameter this method.
     *
     * @param parameter
     * the parameter index.
     * @param desc
     * the class descriptor of the annotation class.
     * @param visible
     * <tt>true</tt> if the annotation is visible at runtime.
     * @return a visitor to visit the annotation values, or <tt>null</tt> if
     * this visitor is not interested in visiting this annotation.
     */
  visitParameterAnnotation(parameter, desc, visible) {
    if (this.mv != null) {
      return this.mv.visitParameterAnnotation(parameter, desc, visible);
    }
    return null;
  }
  /**
     * Visits a non standard attribute of this method.
     *
     * @param attr
     * an attribute.
     */
  visitAttribute(attr) {
    if (this.mv != null) {
      this.mv.visitAttribute(attr);
    }
  }
  /**
     * Starts the visit of the method's code, if any (i.e. non abstract method).
     */
  visitCode() {
    if (this.mv != null) {
      this.mv.visitCode();
    }
  }
  /**
     * Visits the current state of the local variables and operand stack
     * elements. This method must(*) be called <i>just before</i> any
     * instruction <b>i</b> that follows an unconditional branch instruction
     * such as GOTO or THROW, that is the target of a jump instruction, or that
     * starts an exception handler block. The visited types must describe the
     * values of the local variables and of the operand stack elements <i>just
     * before</i> <b>i</b> is executed.<br>
     * <br>
     * (*) this is mandatory only for classes whose version is greater than or
     * equal to {@link Opcodes#V1_6 V1_6}. <br>
     * <br>
     * The frames of a method must be given either in expanded form, or in
     * compressed form (all frames must use the same format, i.e. you must not
     * mix expanded and compressed frames within a single method):
     * <ul>
     * <li>In expanded form, all frames must have the F_NEW type.</li>
     * <li>In compressed form, frames are basically "deltas" from the state of
     * the previous frame:
     * <ul>
     * <li>{@link Opcodes#F_SAME} representing frame with exactly the same
     * locals as the previous frame and with the empty stack.</li>
     * <li>{@link Opcodes#F_SAME1} representing frame with exactly the same
     * locals as the previous frame and with single value on the stack (
     * <code>nStack</code> is 1 and <code>stack[0]</code> contains value for the
     * type of the stack item).</li>
     * <li>{@link Opcodes#F_APPEND} representing frame with current locals are
     * the same as the locals in the previous frame, except that additional
     * locals are defined (<code>nLocal</code> is 1, 2 or 3 and
     * <code>local</code> elements contains values representing added types).</li>
     * <li>{@link Opcodes#F_CHOP} representing frame with current locals are the
     * same as the locals in the previous frame, except that the last 1-3 locals
     * are absent and with the empty stack (<code>nLocals</code> is 1, 2 or 3).</li>
     * <li>{@link Opcodes#F_FULL} representing complete frame data.</li>
     * </ul>
     * </li>
     * </ul>
     * <br>
     * In both cases the first frame, corresponding to the method's parameters
     * and access flags, is implicit and must not be visited. Also, it is
     * illegal to visit two or more frames for the same code location (i.e., at
     * least one instruction must be visited between two calls to visitFrame).
     *
     * @param type
     * the type of this stack map frame. Must be
     * {@link Opcodes#F_NEW} for expanded frames, or
     * {@link Opcodes#F_FULL}, {@link Opcodes#F_APPEND},
     * {@link Opcodes#F_CHOP}, {@link Opcodes#F_SAME} or
     * {@link Opcodes#F_APPEND}, {@link Opcodes#F_SAME1} for
     * compressed frames.
     * @param nLocal
     * the number of local variables in the visited frame.
     * @param local
     * the local variable types in this frame. This array must not be
     * modified. Primitive types are represented by
     * {@link Opcodes#TOP}, {@link Opcodes#INTEGER},
     * {@link Opcodes#FLOAT}, {@link Opcodes#LONG},
     * {@link Opcodes#DOUBLE},{@link Opcodes#NULL} or
     * {@link Opcodes#UNINITIALIZED_THIS} (long and double are
     * represented by a single element). Reference types are
     * represented by String objects (representing internal names),
     * and uninitialized types by Label objects (this label
     * designates the NEW instruction that created this uninitialized
     * value).
     * @param nStack
     * the number of operand stack elements in the visited frame.
     * @param stack
     * the operand stack types in this frame. This array must not be
     * modified. Its content has the same format as the "local"
     * array.
     * @throws IllegalStateException
     * if a frame is visited just after another one, without any
     * instruction between the two (unless this frame is a
     * Opcodes#F_SAME frame, in which case it is silently ignored).
     */
  visitFrame(type, nLocal, local, nStack, stack) {
    if ((typeof type === "number" || type === null) && (typeof nLocal === "number" || nLocal === null) && (local != null && local instanceof Array || local === null) && (typeof nStack === "number" || nStack === null) && (stack != null && stack instanceof Array || stack === null)) {
      const __args = Array.prototype.slice.call(arguments);
      return (() => {
        if (this.mv != null) {
          this.mv.visitFrame(type, nLocal, local, nStack, stack);
        }
      })();
    } else {
      throw new Error("invalid overload");
    }
  }
  /**
     * Visits a zero operand instruction.
     *
     * @param opcode
     * the opcode of the instruction to be visited. This opcode is
     * either NOP, ACONST_NULL, ICONST_M1, ICONST_0, ICONST_1,
     * ICONST_2, ICONST_3, ICONST_4, ICONST_5, LCONST_0, LCONST_1,
     * FCONST_0, FCONST_1, FCONST_2, DCONST_0, DCONST_1, IALOAD,
     * LALOAD, FALOAD, DALOAD, AALOAD, BALOAD, CALOAD, SALOAD,
     * IASTORE, LASTORE, FASTORE, DASTORE, AASTORE, BASTORE, CASTORE,
     * SASTORE, POP, POP2, DUP, DUP_X1, DUP_X2, DUP2, DUP2_X1,
     * DUP2_X2, SWAP, IADD, LADD, FADD, DADD, ISUB, LSUB, FSUB, DSUB,
     * IMUL, LMUL, FMUL, DMUL, IDIV, LDIV, FDIV, DDIV, IREM, LREM,
     * FREM, DREM, INEG, LNEG, FNEG, DNEG, ISHL, LSHL, ISHR, LSHR,
     * IUSHR, LUSHR, IAND, LAND, IOR, LOR, IXOR, LXOR, I2L, I2F, I2D,
     * L2I, L2F, L2D, F2I, F2L, F2D, D2I, D2L, D2F, I2B, I2C, I2S,
     * LCMP, FCMPL, FCMPG, DCMPL, DCMPG, IRETURN, LRETURN, FRETURN,
     * DRETURN, ARETURN, RETURN, ARRAYLENGTH, ATHROW, MONITORENTER,
     * or MONITOREXIT.
     */
  visitInsn(opcode) {
    if (this.mv != null) {
      this.mv.visitInsn(opcode);
    }
  }
  /**
     * Visits an instruction with a single int operand.
     *
     * @param opcode
     * the opcode of the instruction to be visited. This opcode is
     * either BIPUSH, SIPUSH or NEWARRAY.
     * @param operand
     * the operand of the instruction to be visited.<br>
     * When opcode is BIPUSH, operand value should be between
     * Byte.MIN_VALUE and Byte.MAX_VALUE.<br>
     * When opcode is SIPUSH, operand value should be between
     * Short.MIN_VALUE and Short.MAX_VALUE.<br>
     * When opcode is NEWARRAY, operand value should be one of
     * {@link Opcodes#T_BOOLEAN}, {@link Opcodes#T_CHAR},
     * {@link Opcodes#T_FLOAT}, {@link Opcodes#T_DOUBLE},
     * {@link Opcodes#T_BYTE}, {@link Opcodes#T_SHORT},
     * {@link Opcodes#T_INT} or {@link Opcodes#T_LONG}.
     */
  visitIntInsn(opcode, operand) {
    if (this.mv != null) {
      this.mv.visitIntInsn(opcode, operand);
    }
  }
  /**
     * Visits a local variable instruction. A local variable instruction is an
     * instruction that loads or stores the value of a local variable.
     *
     * @param opcode
     * the opcode of the local variable instruction to be visited.
     * This opcode is either ILOAD, LLOAD, FLOAD, DLOAD, ALOAD,
     * ISTORE, LSTORE, FSTORE, DSTORE, ASTORE or RET.
     * @param var
     * the operand of the instruction to be visited. This operand is
     * the index of a local variable.
     */
  visitVarInsn(opcode, __var) {
    if (this.mv != null) {
      this.mv.visitVarInsn(opcode, __var);
    }
  }
  /**
     * Visits a type instruction. A type instruction is an instruction that
     * takes the internal name of a class as parameter.
     *
     * @param opcode
     * the opcode of the type instruction to be visited. This opcode
     * is either NEW, ANEWARRAY, CHECKCAST or INSTANCEOF.
     * @param type
     * the operand of the instruction to be visited. This operand
     * must be the internal name of an object or array class (see
     * {@link Type#getInternalName() getInternalName}).
     */
  visitTypeInsn(opcode, type) {
    if (this.mv != null) {
      this.mv.visitTypeInsn(opcode, type);
    }
  }
  /**
     * Visits a field instruction. A field instruction is an instruction that
     * loads or stores the value of a field of an object.
     *
     * @param opcode
     * the opcode of the type instruction to be visited. This opcode
     * is either GETSTATIC, PUTSTATIC, GETFIELD or PUTFIELD.
     * @param owner
     * the internal name of the field's owner class (see
     * {@link Type#getInternalName() getInternalName}).
     * @param name
     * the field's name.
     * @param desc
     * the field's descriptor (see {@link Type Type}).
     */
  visitFieldInsn(opcode, owner, name, desc) {
    if (this.mv != null) {
      this.mv.visitFieldInsn(opcode, owner, name, desc);
    }
  }
  /**
     * Visits a method instruction. A method instruction is an instruction that
     * invokes a method.
     *
     * @param opcode
     * the opcode of the type instruction to be visited. This opcode
     * is either INVOKEVIRTUAL, INVOKESPECIAL, INVOKESTATIC or
     * INVOKEINTERFACE.
     * @param owner
     * the internal name of the method's owner class (see
     * {@link Type#getInternalName() getInternalName}).
     * @param name
     * the method's name.
     * @param desc
     * the method's descriptor (see {@link Type Type}).
     */
  visitMethodInsn$int$java_lang_String$java_lang_String$java_lang_String(opcode, owner, name, desc) {
    if (this.api >= 327680 /* ASM5 */) {
      const itf = opcode === 185 /* INVOKEINTERFACE */;
      this.visitMethodInsn(opcode, owner, name, desc, itf);
      return;
    }
    if (this.mv != null) {
      this.mv.visitMethodInsn(opcode, owner, name, desc);
    }
  }
  /**
     * Visits a method instruction. A method instruction is an instruction that
     * invokes a method.
     *
     * @param opcode
     * the opcode of the type instruction to be visited. This opcode
     * is either INVOKEVIRTUAL, INVOKESPECIAL, INVOKESTATIC or
     * INVOKEINTERFACE.
     * @param owner
     * the internal name of the method's owner class (see
     * {@link Type#getInternalName() getInternalName}).
     * @param name
     * the method's name.
     * @param desc
     * the method's descriptor (see {@link Type Type}).
     * @param itf
     * if the method's owner class is an interface.
     */
  visitMethodInsn(opcode, owner, name, desc, itf) {
    if ((typeof opcode === "number" || opcode === null) && (typeof owner === "string" || owner === null) && (typeof name === "string" || name === null) && (typeof desc === "string" || desc === null) && (typeof itf === "boolean" || itf === null)) {
      const __args = Array.prototype.slice.call(arguments);
      return (() => {
        if (this.api < 327680 /* ASM5 */) {
          if (itf !== (opcode === 185 /* INVOKEINTERFACE */)) {
            throw new Error("INVOKESPECIAL/STATIC on interfaces require ASM 5");
          }
          this.visitMethodInsn(opcode, owner, name, desc);
          return;
        }
        if (this.mv != null) {
          this.mv.visitMethodInsn(opcode, owner, name, desc, itf);
        }
      })();
    } else if ((typeof opcode === "number" || opcode === null) && (typeof owner === "string" || owner === null) && (typeof name === "string" || name === null) && (typeof desc === "string" || desc === null) && itf === void 0) {
      return this.visitMethodInsn$int$java_lang_String$java_lang_String$java_lang_String(opcode, owner, name, desc);
    } else {
      throw new Error("invalid overload");
    }
  }
  /**
     * Visits an invokedynamic instruction.
     *
     * @param name
     * the method's name.
     * @param desc
     * the method's descriptor (see {@link Type Type}).
     * @param bsm
     * the bootstrap method.
     * @param bsmArgs
     * the bootstrap method constant arguments. Each argument must be
     * an {@link Integer}, {@link Float}, {@link Long},
     * {@link Double}, {@link String}, {@link Type} or {@link Handle}
     * value. This method is allowed to modify the content of the
     * array so a caller should expect that this array may change.
     */
  visitInvokeDynamicInsn(name, desc, bsm, ...bsmArgs) {
    if (this.mv != null) {
      this.mv.visitInvokeDynamicInsn(name, desc, bsm, ...bsmArgs);
    }
  }
  /**
     * Visits a jump instruction. A jump instruction is an instruction that may
     * jump to another instruction.
     *
     * @param opcode
     * the opcode of the type instruction to be visited. This opcode
     * is either IFEQ, IFNE, IFLT, IFGE, IFGT, IFLE, IF_ICMPEQ,
     * IF_ICMPNE, IF_ICMPLT, IF_ICMPGE, IF_ICMPGT, IF_ICMPLE,
     * IF_ACMPEQ, IF_ACMPNE, GOTO, JSR, IFNULL or IFNONNULL.
     * @param label
     * the operand of the instruction to be visited. This operand is
     * a label that designates the instruction to which the jump
     * instruction may jump.
     */
  visitJumpInsn(opcode, label) {
    if (this.mv != null) {
      this.mv.visitJumpInsn(opcode, label);
    }
  }
  /**
     * Visits a label. A label designates the instruction that will be visited
     * just after it.
     *
     * @param label
     * a {@link Label Label} object.
     */
  visitLabel(label) {
    if (this.mv != null) {
      this.mv.visitLabel(label);
    }
  }
  /**
     * Visits a LDC instruction. Note that new constant types may be added in
     * future versions of the Java Virtual Machine. To easily detect new
     * constant types, implementations of this method should check for
     * unexpected constant types, like this:
     *
     * <pre>
     * if (cst instanceof Integer) {
     * // ...
     * } else if (cst instanceof Float) {
     * // ...
     * } else if (cst instanceof Long) {
     * // ...
     * } else if (cst instanceof Double) {
     * // ...
     * } else if (cst instanceof String) {
     * // ...
     * } else if (cst instanceof Type) {
     * int sort = ((Type) cst).getSort();
     * if (sort == Type.OBJECT) {
     * // ...
     * } else if (sort == Type.ARRAY) {
     * // ...
     * } else if (sort == Type.METHOD) {
     * // ...
     * } else {
     * // throw an exception
     * }
     * } else if (cst instanceof Handle) {
     * // ...
     * } else {
     * // throw an exception
     * }
     * </pre>
     *
     * @param cst
     * the constant to be loaded on the stack. This parameter must be
     * a non null {@link Integer}, a {@link Float}, a {@link Long}, a
     * {@link Double}, a {@link String}, a {@link Type} of OBJECT or
     * ARRAY sort for <tt>.class</tt> constants, for classes whose
     * version is 49.0, a {@link Type} of METHOD sort or a
     * {@link Handle} for MethodType and MethodHandle constants, for
     * classes whose version is 51.0.
     */
  visitLdcInsn(cst) {
    if (this.mv != null) {
      this.mv.visitLdcInsn(cst);
    }
  }
  /**
     * Visits an IINC instruction.
     *
     * @param var
     * index of the local variable to be incremented.
     * @param increment
     * amount to increment the local variable by.
     */
  visitIincInsn(__var, increment) {
    if (this.mv != null) {
      this.mv.visitIincInsn(__var, increment);
    }
  }
  /**
     * Visits a TABLESWITCH instruction.
     *
     * @param min
     * the minimum key value.
     * @param max
     * the maximum key value.
     * @param dflt
     * beginning of the default handler block.
     * @param labels
     * beginnings of the handler blocks. <tt>labels[i]</tt> is the
     * beginning of the handler block for the <tt>min + i</tt> key.
     */
  visitTableSwitchInsn(min, max, dflt, ...labels) {
    if (this.mv != null) {
      this.mv.visitTableSwitchInsn(min, max, dflt, ...labels);
    }
  }
  /**
     * Visits a LOOKUPSWITCH instruction.
     *
     * @param dflt
     * beginning of the default handler block.
     * @param keys
     * the values of the keys.
     * @param labels
     * beginnings of the handler blocks. <tt>labels[i]</tt> is the
     * beginning of the handler block for the <tt>keys[i]</tt> key.
     */
  visitLookupSwitchInsn(dflt, keys, labels) {
    if (this.mv != null) {
      this.mv.visitLookupSwitchInsn(dflt, keys, labels);
    }
  }
  /**
     * Visits a MULTIANEWARRAY instruction.
     *
     * @param desc
     * an array type descriptor (see {@link Type Type}).
     * @param dims
     * number of dimensions of the array to allocate.
     */
  visitMultiANewArrayInsn(desc, dims) {
    if (this.mv != null) {
      this.mv.visitMultiANewArrayInsn(desc, dims);
    }
  }
  /**
     * Visits an annotation on an instruction. This method must be called just
     * <i>after</i> the annotated instruction. It can be called several times
     * for the same instruction.
     *
     * @param typeRef
     * a reference to the annotated type. The sort of this type
     * reference must be {@link TypeReference#INSTANCEOF INSTANCEOF},
     * {@link TypeReference#NEW NEW},
     * {@link TypeReference#CONSTRUCTOR_REFERENCE
     * CONSTRUCTOR_REFERENCE}, {@link TypeReference#METHOD_REFERENCE
     * METHOD_REFERENCE}, {@link TypeReference#CAST CAST},
     * {@link TypeReference#CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT
     * CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT},
     * {@link TypeReference#METHOD_INVOCATION_TYPE_ARGUMENT
     * METHOD_INVOCATION_TYPE_ARGUMENT},
     * {@link TypeReference#CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT
     * CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT}, or
     * {@link TypeReference#METHOD_REFERENCE_TYPE_ARGUMENT
     * METHOD_REFERENCE_TYPE_ARGUMENT}. See {@link TypeReference}.
     * @param typePath
     * the path to the annotated type argument, wildcard bound, array
     * element type, or static inner type within 'typeRef'. May be
     * <tt>null</tt> if the annotation targets 'typeRef' as a whole.
     * @param desc
     * the class descriptor of the annotation class.
     * @param visible
     * <tt>true</tt> if the annotation is visible at runtime.
     * @return a visitor to visit the annotation values, or <tt>null</tt> if
     * this visitor is not interested in visiting this annotation.
     */
  visitInsnAnnotation(typeRef, typePath, desc, visible) {
    if (this.api < 327680 /* ASM5 */) {
      throw new Error();
    }
    if (this.mv != null) {
      return this.mv.visitInsnAnnotation(typeRef, typePath, desc, visible);
    }
    return null;
  }
  /**
     * Visits a try catch block.
     *
     * @param start
     * beginning of the exception handler's scope (inclusive).
     * @param end
     * end of the exception handler's scope (exclusive).
     * @param handler
     * beginning of the exception handler's code.
     * @param type
     * internal name of the type of exceptions handled by the
     * handler, or <tt>null</tt> to catch any exceptions (for
     * "finally" blocks).
     * @throws IllegalArgumentException
     * if one of the labels has already been visited by this visitor
     * (by the {@link #visitLabel visitLabel} method).
     */
  visitTryCatchBlock(start, end, handler, type) {
    if (this.mv != null) {
      this.mv.visitTryCatchBlock(start, end, handler, type);
    }
  }
  /**
     * Visits an annotation on an exception handler type. This method must be
     * called <i>after</i> the {@link #visitTryCatchBlock} for the annotated
     * exception handler. It can be called several times for the same exception
     * handler.
     *
     * @param typeRef
     * a reference to the annotated type. The sort of this type
     * reference must be {@link TypeReference#EXCEPTION_PARAMETER
     * EXCEPTION_PARAMETER}. See {@link TypeReference}.
     * @param typePath
     * the path to the annotated type argument, wildcard bound, array
     * element type, or static inner type within 'typeRef'. May be
     * <tt>null</tt> if the annotation targets 'typeRef' as a whole.
     * @param desc
     * the class descriptor of the annotation class.
     * @param visible
     * <tt>true</tt> if the annotation is visible at runtime.
     * @return a visitor to visit the annotation values, or <tt>null</tt> if
     * this visitor is not interested in visiting this annotation.
     */
  visitTryCatchAnnotation(typeRef, typePath, desc, visible) {
    if (this.api < 327680 /* ASM5 */) {
      throw new Error();
    }
    if (this.mv != null) {
      return this.mv.visitTryCatchAnnotation(typeRef, typePath, desc, visible);
    }
    return null;
  }
  /**
     * Visits a local variable declaration.
     *
     * @param name
     * the name of a local variable.
     * @param desc
     * the type descriptor of this local variable.
     * @param signature
     * the type signature of this local variable. May be
     * <tt>null</tt> if the local variable type does not use generic
     * types.
     * @param start
     * the first instruction corresponding to the scope of this local
     * variable (inclusive).
     * @param end
     * the last instruction corresponding to the scope of this local
     * variable (exclusive).
     * @param index
     * the local variable's index.
     * @throws IllegalArgumentException
     * if one of the labels has not already been visited by this
     * visitor (by the {@link #visitLabel visitLabel} method).
     */
  visitLocalVariable(name, desc, signature, start, end, index) {
    if (this.mv != null) {
      this.mv.visitLocalVariable(name, desc, signature, start, end, index);
    }
  }
  /**
     * Visits an annotation on a local variable type.
     *
     * @param typeRef
     * a reference to the annotated type. The sort of this type
     * reference must be {@link TypeReference#LOCAL_VARIABLE
     * LOCAL_VARIABLE} or {@link TypeReference#RESOURCE_VARIABLE
     * RESOURCE_VARIABLE}. See {@link TypeReference}.
     * @param typePath
     * the path to the annotated type argument, wildcard bound, array
     * element type, or static inner type within 'typeRef'. May be
     * <tt>null</tt> if the annotation targets 'typeRef' as a whole.
     * @param start
     * the fist instructions corresponding to the continuous ranges
     * that make the scope of this local variable (inclusive).
     * @param end
     * the last instructions corresponding to the continuous ranges
     * that make the scope of this local variable (exclusive). This
     * array must have the same size as the 'start' array.
     * @param index
     * the local variable's index in each range. This array must have
     * the same size as the 'start' array.
     * @param desc
     * the class descriptor of the annotation class.
     * @param visible
     * <tt>true</tt> if the annotation is visible at runtime.
     * @return a visitor to visit the annotation values, or <tt>null</tt> if
     * this visitor is not interested in visiting this annotation.
     */
  visitLocalVariableAnnotation(typeRef, typePath, start, end, index, desc, visible) {
    if (this.api < 327680 /* ASM5 */) {
      throw new Error();
    }
    if (this.mv != null) {
      return this.mv.visitLocalVariableAnnotation(typeRef, typePath, start, end, index, desc, visible);
    }
    return null;
  }
  /**
     * Visits a line number declaration.
     *
     * @param line
     * a line number. This number refers to the source file from
     * which the class was compiled.
     * @param start
     * the first instruction corresponding to this line number.
     * @throws IllegalArgumentException
     * if <tt>start</tt> has not already been visited by this
     * visitor (by the {@link #visitLabel visitLabel} method).
     */
  visitLineNumber(line, start) {
    if (this.mv != null) {
      this.mv.visitLineNumber(line, start);
    }
  }
  /**
     * Visits the maximum stack size and the maximum number of local variables
     * of the method.
     *
     * @param maxStack
     * maximum stack size of the method.
     * @param maxLocals
     * maximum number of local variables for the method.
     */
  visitMaxs(maxStack, maxLocals) {
    if (this.mv != null) {
      this.mv.visitMaxs(maxStack, maxLocals);
    }
  }
  /**
     * Visits the end of the method. This method, which is the last one to be
     * called, is used to inform the visitor that all the annotations and
     * attributes of the method have been visited.
     */
  visitEnd() {
    if (this.mv != null) {
      this.mv.visitEnd();
    }
  }
};

// libs/Frame.ts
var _Frame = class {
  constructor(owner) {
    /**
       * The label (i.e. basic block) to which these input and output stack map
       * frames correspond.
       */
    __publicField(this, "owner");
    /**
       * The input stack map frame locals.
       */
    __publicField(this, "inputLocals", []);
    /**
       * The input stack map frame stack.
       */
    __publicField(this, "inputStack", []);
    /**
       * The output stack map frame locals.
       */
    __publicField(this, "outputLocals", []);
    /**
       * The output stack map frame stack.
       */
    __publicField(this, "outputStack", []);
    /**
       * Relative size of the output stack. The exact semantics of this field
       * depends on the algorithm that is used.
       *
       * When only the maximum stack size is computed, this field is the size of
       * the output stack relatively to the top of the input stack.
       *
       * When the stack map frames are completely computed, this field is the
       * actual number of types in {@link #outputStack}.
       */
    __publicField(this, "outputStackTop");
    /**
       * Number of types that are initialized in the basic block.
       *
       * @see #initializations
       */
    __publicField(this, "initializationCount");
    /**
       * The types that are initialized in the basic block. A constructor
       * invocation on an UNINITIALIZED or UNINITIALIZED_THIS type must replace
       * <i>every occurence</i> of this type in the local variables and in the
       * operand stack. This cannot be done during the first phase of the
       * algorithm since, during this phase, the local variables and the operand
       * stack are not completely computed. It is therefore necessary to store the
       * types on which constructors are invoked in the basic block, in order to
       * do this replacement during the second phase of the algorithm, where the
       * frames are fully computed. Note that this array can contain types that
       * are relative to input locals or to the input stack (see below for the
       * description of the algorithm).
       */
    __publicField(this, "initializations", null);
    this.outputStackTop = 0;
    this.initializationCount = 0;
    this.owner = owner;
  }
  static __static_initialize() {
    if (!_Frame.__static_initialized) {
      _Frame.__static_initialized = true;
      _Frame.__static_initializer_0();
    }
  }
  static OBJECT_$LI$() {
    _Frame.__static_initialize();
    if (_Frame.OBJECT == null) {
      _Frame.OBJECT = _Frame.BASE | 7340032;
    }
    return _Frame.OBJECT;
  }
  static UNINITIALIZED_$LI$() {
    _Frame.__static_initialize();
    if (_Frame.UNINITIALIZED == null) {
      _Frame.UNINITIALIZED = _Frame.BASE | 8388608;
    }
    return _Frame.UNINITIALIZED;
  }
  static TOP_$LI$() {
    _Frame.__static_initialize();
    if (_Frame.TOP == null) {
      _Frame.TOP = _Frame.BASE | 0;
    }
    return _Frame.TOP;
  }
  static BOOLEAN_$LI$() {
    _Frame.__static_initialize();
    if (_Frame.BOOLEAN == null) {
      _Frame.BOOLEAN = _Frame.BASE | 9;
    }
    return _Frame.BOOLEAN;
  }
  static BYTE_$LI$() {
    _Frame.__static_initialize();
    if (_Frame.BYTE == null) {
      _Frame.BYTE = _Frame.BASE | 10;
    }
    return _Frame.BYTE;
  }
  static CHAR_$LI$() {
    _Frame.__static_initialize();
    if (_Frame.CHAR == null) {
      _Frame.CHAR = _Frame.BASE | 11;
    }
    return _Frame.CHAR;
  }
  static SHORT_$LI$() {
    _Frame.__static_initialize();
    if (_Frame.SHORT == null) {
      _Frame.SHORT = _Frame.BASE | 12;
    }
    return _Frame.SHORT;
  }
  static INTEGER_$LI$() {
    _Frame.__static_initialize();
    if (_Frame.INTEGER == null) {
      _Frame.INTEGER = _Frame.BASE | 1;
    }
    return _Frame.INTEGER;
  }
  static FLOAT_$LI$() {
    _Frame.__static_initialize();
    if (_Frame.FLOAT == null) {
      _Frame.FLOAT = _Frame.BASE | 2;
    }
    return _Frame.FLOAT;
  }
  static DOUBLE_$LI$() {
    _Frame.__static_initialize();
    if (_Frame.DOUBLE == null) {
      _Frame.DOUBLE = _Frame.BASE | 3;
    }
    return _Frame.DOUBLE;
  }
  static LONG_$LI$() {
    _Frame.__static_initialize();
    if (_Frame.LONG == null) {
      _Frame.LONG = _Frame.BASE | 4;
    }
    return _Frame.LONG;
  }
  static NULL_$LI$() {
    _Frame.__static_initialize();
    if (_Frame.NULL == null) {
      _Frame.NULL = _Frame.BASE | 5;
    }
    return _Frame.NULL;
  }
  static UNINITIALIZED_THIS_$LI$() {
    _Frame.__static_initialize();
    if (_Frame.UNINITIALIZED_THIS == null) {
      _Frame.UNINITIALIZED_THIS = _Frame.BASE | 6;
    }
    return _Frame.UNINITIALIZED_THIS;
  }
  static SIZE_$LI$() {
    _Frame.__static_initialize();
    return _Frame.SIZE;
  }
  static __static_initializer_0() {
    let i;
    const b = new Array(202);
    const s = "EFFFFFFFFGGFFFGGFFFEEFGFGFEEEEEEEEEEEEEEEEEEEEDEDEDDDDDCDCDEEEEEEEEEEEEEEEEEEEEBABABBBBDCFFFGGGEDCDCDCDCDCDCDCDCDCDCEEEEDDDDDDDCDCDCEFEFDDEEFFDEDEEEBDDBBDDDDDDCCCCCCCCEFEDDDCDCDEEEEEEEEEEFEEEEEEDDEEDDEE";
    for (i = 0; i < b.length; ++i) {
      b[i] = s.charAt(i).charCodeAt(0) - "E".charCodeAt(0);
    }
    _Frame.SIZE = b;
  }
  /**
     * Sets this frame to the given value.
     *
     * @param cw
     * the ClassWriter to which this label belongs.
     * @param nLocal
     * the number of local variables.
     * @param local
     * the local variable types. Primitive types are represented by
     * {@link Opcodes#TOP}, {@link Opcodes#INTEGER},
     * {@link Opcodes#FLOAT}, {@link Opcodes#LONG},
     * {@link Opcodes#DOUBLE},{@link Opcodes#NULL} or
     * {@link Opcodes#UNINITIALIZED_THIS} (long and double are
     * represented by a single element). Reference types are
     * represented by String objects (representing internal names),
     * and uninitialized types by Label objects (this label
     * designates the NEW instruction that created this uninitialized
     * value).
     * @param nStack
     * the number of operand stack elements.
     * @param stack
     * the operand stack types (same format as the "local" array).
     */
  set(cw, nLocal, local, nStack, stack) {
    if ((cw != null && cw instanceof ClassWriter || cw === null) && (typeof nLocal === "number" || nLocal === null) && (local != null && local instanceof Array || local === null) && (typeof nStack === "number" || nStack === null) && (stack != null && stack instanceof Array || stack === null)) {
      const __args = Array.prototype.slice.call(arguments);
      return (() => {
        let i = _Frame.convert(cw, nLocal, local, this.inputLocals);
        while (i < local.length) {
          this.inputLocals[i++] = _Frame.TOP_$LI$();
        }
        let nStackTop = 0;
        for (let j = 0; j < nStack; ++j) {
          if (stack[j] === 4 /* LONG */ || stack[j] === 3 /* DOUBLE */) {
            ++nStackTop;
          }
        }
        this.inputStack = new Array(nStack + nStackTop);
        _Frame.convert(cw, nStack, stack, this.inputStack);
        this.outputStackTop = 0;
        this.initializationCount = 0;
      })();
    } else if ((typeof cw === "number" || cw === null) && (typeof nLocal === "number" || nLocal === null) && local === void 0 && nStack === void 0 && stack === void 0) {
      return this.set$int$int(cw, nLocal);
    } else if ((cw != null && cw instanceof _Frame || cw === null) && nLocal === void 0 && local === void 0 && nStack === void 0 && stack === void 0) {
      return this.set$Frame(cw);
    } else {
      throw new Error("invalid overload");
    }
  }
  /**
     * Converts types from the MethodWriter.visitFrame() format to the Frame
     * format.
     *
     * @param cw
     * the ClassWriter to which this label belongs.
     * @param nInput
     * the number of types to convert.
     * @param input
     * the types to convert. Primitive types are represented by
     * {@link Opcodes#TOP}, {@link Opcodes#INTEGER},
     * {@link Opcodes#FLOAT}, {@link Opcodes#LONG},
     * {@link Opcodes#DOUBLE},{@link Opcodes#NULL} or
     * {@link Opcodes#UNINITIALIZED_THIS} (long and double are
     * represented by a single element). Reference types are
     * represented by String objects (representing internal names),
     * and uninitialized types by Label objects (this label
     * designates the NEW instruction that created this uninitialized
     * value).
     * @param output
     * where to store the converted types.
     * @return the number of output elements.
     */
  static convert(cw, nInput, input, output) {
    let i = 0;
    for (let j = 0; j < nInput; ++j) {
      if (typeof input[j] === "number") {
        output[i++] = _Frame.BASE | /* intValue */
        (input[j] | 0);
        if (input[j] === 4 /* LONG */ || input[j] === 3 /* DOUBLE */) {
          output[i++] = _Frame.TOP_$LI$();
        }
      } else if (typeof input[j] === "string") {
        output[i++] = _Frame.type(cw, Type.getObjectType(input[j]).getDescriptor());
      } else {
        output[i++] = _Frame.UNINITIALIZED_$LI$() | cw.addUninitializedType("", input[j].position);
      }
    }
    return i;
  }
  /**
     * Sets this frame to the value of the given frame. WARNING: after this
     * method is called the two frames share the same data structures. It is
     * recommended to discard the given frame f to avoid unexpected side
     * effects.
     *
     * @param f
     * The new frame value.
     */
  set$Frame(f) {
    this.inputLocals = f.inputLocals;
    this.inputStack = f.inputStack;
    this.outputLocals = f.outputLocals;
    this.outputStack = f.outputStack;
    this.outputStackTop = f.outputStackTop;
    this.initializationCount = f.initializationCount;
    this.initializations = f.initializations;
  }
  /**
     * Returns the output frame local variable type at the given index.
     *
     * @param local
     * the index of the local that must be returned.
     * @return the output frame local variable type at the given index.
     */
  get(local) {
    if (this.outputLocals == null || local >= this.outputLocals.length) {
      return _Frame.LOCAL | local;
    } else {
      let type = this.outputLocals[local];
      if (type === 0) {
        type = this.outputLocals[local] = _Frame.LOCAL | local;
      }
      return type;
    }
  }
  /**
     * Sets the output frame local variable type at the given index.
     *
     * @param local
     * the index of the local that must be set.
     * @param type
     * the value of the local that must be set.
     */
  set$int$int(local, type) {
    if (this.outputLocals == null) {
      this.outputLocals = new Array(10);
    }
    const n = this.outputLocals.length;
    if (local >= n) {
      const t = new Array(Math.max(local + 1, 2 * n));
      for (let i = 0; i < n; i++) {
        t[i] = this.outputLocals[i];
      }
      this.outputLocals = t;
    }
    this.outputLocals[local] = type;
  }
  /**
     * Pushes a new type onto the output frame stack.
     *
     * @param type
     * the type that must be pushed.
     */
  push$int(type) {
    if (this.outputStack == null) {
      this.outputStack = new Array(10);
    }
    const n = this.outputStack.length;
    if (this.outputStackTop >= n) {
      const t = new Array(Math.max(this.outputStackTop + 1, 2 * n));
      for (let i = 0; i < n; i++) {
        t[i] = this.outputStack[i];
      }
      this.outputStack = t;
    }
    this.outputStack[this.outputStackTop++] = type;
    assert(this.owner);
    const top = this.owner.inputStackTop + this.outputStackTop;
    if (top > this.owner.outputStackMax) {
      this.owner.outputStackMax = top;
    }
  }
  /**
     * Pushes a new type onto the output frame stack.
     *
     * @param cw
     * the ClassWriter to which this label belongs.
     * @param desc
     * the descriptor of the type to be pushed. Can also be a method
     * descriptor (in this case this method pushes its return type
     * onto the output frame stack).
     */
  push(cw, desc) {
    if ((cw != null && cw instanceof ClassWriter || cw === null) && (typeof desc === "string" || desc === null)) {
      const __args = Array.prototype.slice.call(arguments);
      return (() => {
        const type = _Frame.type(cw, desc);
        if (type !== 0) {
          this.push(type);
          if (type === _Frame.LONG_$LI$() || type === _Frame.DOUBLE_$LI$()) {
            this.push(_Frame.TOP_$LI$());
          }
        }
      })();
    } else if ((typeof cw === "number" || cw === null) && desc === void 0) {
      return this.push$int(cw);
    } else {
      throw new Error("invalid overload");
    }
  }
  /**
     * Returns the int encoding of the given type.
     *
     * @param cw
     * the ClassWriter to which this label belongs.
     * @param desc
     * a type descriptor.
     * @return the int encoding of the given type.
     */
  static type(cw, desc) {
    let t;
    const index = desc.charAt(0) === "(" ? desc.indexOf(")") + 1 : 0;
    switch (desc.charAt(index)) {
      case "V":
        return 0;
      case "Z":
      case "C":
      case "B":
      case "S":
      case "I":
        return _Frame.INTEGER_$LI$();
      case "F":
        return _Frame.FLOAT_$LI$();
      case "J":
        return _Frame.LONG_$LI$();
      case "D":
        return _Frame.DOUBLE_$LI$();
      case "L":
        t = desc.substring(index + 1, desc.length - 1);
        return _Frame.OBJECT_$LI$() | cw.addType(t);
      default:
        let data;
        let dims = index + 1;
        while (desc.charAt(dims) === "[") {
          ++dims;
        }
        switch (desc.charAt(dims)) {
          case "Z":
            data = _Frame.BOOLEAN_$LI$();
            break;
          case "C":
            data = _Frame.CHAR_$LI$();
            break;
          case "B":
            data = _Frame.BYTE_$LI$();
            break;
          case "S":
            data = _Frame.SHORT_$LI$();
            break;
          case "I":
            data = _Frame.INTEGER_$LI$();
            break;
          case "F":
            data = _Frame.FLOAT_$LI$();
            break;
          case "J":
            data = _Frame.LONG_$LI$();
            break;
          case "D":
            data = _Frame.DOUBLE_$LI$();
            break;
          default:
            t = desc.substring(dims + 1, desc.length - 1);
            data = _Frame.OBJECT_$LI$() | cw.addType(t);
        }
        return dims - index << 28 | data;
    }
  }
  /**
     * Pops a type from the output frame stack and returns its value.
     *
     * @return the type that has been popped from the output frame stack.
     */
  pop$() {
    if (this.outputStackTop > 0) {
      return this.outputStack[--this.outputStackTop];
    } else {
      return _Frame.STACK | - --this.owner.inputStackTop;
    }
  }
  /**
     * Pops the given number of types from the output frame stack.
     *
     * @param elements
     * the number of types that must be popped.
     */
  pop$int(elements) {
    if (this.outputStackTop >= elements) {
      this.outputStackTop -= elements;
    } else {
      this.owner.inputStackTop -= elements - this.outputStackTop;
      this.outputStackTop = 0;
    }
  }
  /**
     * Pops a type from the output frame stack.
     *
     * @param desc
     * the descriptor of the type to be popped. Can also be a method
     * descriptor (in this case this method pops the types
     * corresponding to the method arguments).
     */
  pop(desc) {
    if (typeof desc === "string" || desc === null) {
      const __args = Array.prototype.slice.call(arguments);
      return (() => {
        const c = desc.charAt(0);
        if (c === "(") {
          this.pop((Type.getArgumentsAndReturnSizes(desc) >> 2) - 1);
        } else if (c === "J" || c === "D") {
          this.pop(2);
        } else {
          this.pop(1);
        }
      })();
    } else if (typeof desc === "number" || desc === null) {
      return this.pop$int(desc);
    } else if (desc === void 0) {
      return this.pop$();
    } else {
      throw new Error("invalid overload");
    }
  }
  /**
     * Adds a new type to the list of types on which a constructor is invoked in
     * the basic block.
     *
     * @param var
     * a type on a which a constructor is invoked.
     */
  init$int(__var) {
    if (this.initializations == null) {
      this.initializations = new Array(2);
    }
    const n = this.initializations.length;
    if (this.initializationCount >= n) {
      const t = new Array(Math.max(this.initializationCount + 1, 2 * n));
      for (let i = 0; i < n; i++) {
        t[i] = this.initializations[i];
      }
      this.initializations = t;
    }
    this.initializations[this.initializationCount++] = __var;
  }
  /**
     * Replaces the given type with the appropriate type if it is one of the
     * types on which a constructor is invoked in the basic block.
     *
     * @param cw
     * the ClassWriter to which this label belongs.
     * @param t
     * a type
     * @return t or, if t is one of the types on which a constructor is invoked
     * in the basic block, the type corresponding to this constructor.
     */
  init(cw, t) {
    if ((cw != null && cw instanceof ClassWriter || cw === null) && (typeof t === "number" || t === null)) {
      const __args = Array.prototype.slice.call(arguments);
      return (() => {
        let s;
        if (t === _Frame.UNINITIALIZED_THIS_$LI$()) {
          s = _Frame.OBJECT_$LI$() | cw.addType(cw.thisName);
        } else if ((t & (_Frame.DIM | _Frame.BASE_KIND)) === _Frame.UNINITIALIZED_$LI$()) {
          const type = cw.typeTable[t & _Frame.BASE_VALUE].strVal1;
          s = _Frame.OBJECT_$LI$() | cw.addType(type);
        } else {
          return t;
        }
        for (let j = 0; j < this.initializationCount; ++j) {
          let u = this.initializations[j];
          const dim = u & _Frame.DIM;
          const kind = u & _Frame.KIND;
          if (kind === _Frame.LOCAL) {
            u = dim + this.inputLocals[u & _Frame.VALUE];
          } else if (kind === _Frame.STACK) {
            u = dim + this.inputStack[this.inputStack.length - (u & _Frame.VALUE)];
          }
          if (t === u) {
            return s;
          }
        }
        return t;
      })();
    } else if ((typeof cw === "number" || cw === null) && t === void 0) {
      return this.init$int(cw);
    } else {
      throw new Error("invalid overload");
    }
  }
  /**
     * Initializes the input frame of the first basic block from the method
     * descriptor.
     *
     * @param cw
     * the ClassWriter to which this label belongs.
     * @param access
     * the access flags of the method to which this label belongs.
     * @param args
     * the formal parameter types of this method.
     * @param maxLocals
     * the maximum number of local variables of this method.
     */
  initInputFrame(cw, access, args, maxLocals) {
    this.inputLocals = new Array(maxLocals);
    this.inputStack = new Array(0);
    let i = 0;
    if ((access & 8 /* ACC_STATIC */) === 0) {
      if ((access & MethodWriter.ACC_CONSTRUCTOR) === 0) {
        this.inputLocals[i++] = _Frame.OBJECT_$LI$() | cw.addType(cw.thisName);
      } else {
        this.inputLocals[i++] = _Frame.UNINITIALIZED_THIS_$LI$();
      }
    }
    for (let j = 0; j < args.length; ++j) {
      const t = _Frame.type(cw, args[j].getDescriptor());
      this.inputLocals[i++] = t;
      if (t === _Frame.LONG_$LI$() || t === _Frame.DOUBLE_$LI$()) {
        this.inputLocals[i++] = _Frame.TOP_$LI$();
      }
    }
    while (i < maxLocals) {
      this.inputLocals[i++] = _Frame.TOP_$LI$();
    }
  }
  /**
     * Simulates the action of the given instruction on the output stack frame.
     *
     * @param opcode
     * the opcode of the instruction.
     * @param arg
     * the operand of the instruction, if any.
     * @param cw
     * the class writer to which this label belongs.
     * @param item
     * the operand of the instructions, if any.
     */
  execute(opcode, arg, cw, item) {
    let t1;
    let t2;
    let t3;
    let t4;
    switch (opcode) {
      case 0 /* NOP */:
      case 116 /* INEG */:
      case 117 /* LNEG */:
      case 118 /* FNEG */:
      case 119 /* DNEG */:
      case 145 /* I2B */:
      case 146 /* I2C */:
      case 147 /* I2S */:
      case 167 /* GOTO */:
      case 177 /* RETURN */:
        break;
      case 1 /* ACONST_NULL */:
        this.push(_Frame.NULL_$LI$());
        break;
      case 2 /* ICONST_M1 */:
      case 3 /* ICONST_0 */:
      case 4 /* ICONST_1 */:
      case 5 /* ICONST_2 */:
      case 6 /* ICONST_3 */:
      case 7 /* ICONST_4 */:
      case 8 /* ICONST_5 */:
      case 16 /* BIPUSH */:
      case 17 /* SIPUSH */:
      case 21 /* ILOAD */:
        this.push(_Frame.INTEGER_$LI$());
        break;
      case 9 /* LCONST_0 */:
      case 10 /* LCONST_1 */:
      case 22 /* LLOAD */:
        this.push(_Frame.LONG_$LI$());
        this.push(_Frame.TOP_$LI$());
        break;
      case 11 /* FCONST_0 */:
      case 12 /* FCONST_1 */:
      case 13 /* FCONST_2 */:
      case 23 /* FLOAD */:
        this.push(_Frame.FLOAT_$LI$());
        break;
      case 14 /* DCONST_0 */:
      case 15 /* DCONST_1 */:
      case 24 /* DLOAD */:
        this.push(_Frame.DOUBLE_$LI$());
        this.push(_Frame.TOP_$LI$());
        break;
      case 18 /* LDC */:
        assert(cw);
        assert(item);
        switch (item.type) {
          case ClassWriter.INT:
            this.push(_Frame.INTEGER_$LI$());
            break;
          case ClassWriter.LONG:
            this.push(_Frame.LONG_$LI$());
            this.push(_Frame.TOP_$LI$());
            break;
          case ClassWriter.FLOAT:
            this.push(_Frame.FLOAT_$LI$());
            break;
          case ClassWriter.DOUBLE:
            this.push(_Frame.DOUBLE_$LI$());
            this.push(_Frame.TOP_$LI$());
            break;
          case ClassWriter.CLASS:
            this.push(_Frame.OBJECT_$LI$() | cw.addType("java/lang/Class"));
            break;
          case ClassWriter.STR:
            this.push(_Frame.OBJECT_$LI$() | cw.addType("java/lang/String"));
            break;
          case ClassWriter.MTYPE:
            this.push(_Frame.OBJECT_$LI$() | cw.addType("java/lang/invoke/MethodType"));
            break;
          default:
            this.push(_Frame.OBJECT_$LI$() | cw.addType("java/lang/invoke/MethodHandle"));
        }
        break;
      case 25 /* ALOAD */:
        this.push(this.get(arg));
        break;
      case 46 /* IALOAD */:
      case 51 /* BALOAD */:
      case 52 /* CALOAD */:
      case 53 /* SALOAD */:
        this.pop(2);
        this.push(_Frame.INTEGER_$LI$());
        break;
      case 47 /* LALOAD */:
      case 143 /* D2L */:
        this.pop(2);
        this.push(_Frame.LONG_$LI$());
        this.push(_Frame.TOP_$LI$());
        break;
      case 48 /* FALOAD */:
        this.pop(2);
        this.push(_Frame.FLOAT_$LI$());
        break;
      case 49 /* DALOAD */:
      case 138 /* L2D */:
        this.pop(2);
        this.push(_Frame.DOUBLE_$LI$());
        this.push(_Frame.TOP_$LI$());
        break;
      case 50 /* AALOAD */:
        this.pop(1);
        t1 = this.pop();
        this.push(_Frame.ELEMENT_OF + t1);
        break;
      case 54 /* ISTORE */:
      case 56 /* FSTORE */:
      case 58 /* ASTORE */:
        t1 = this.pop();
        this.set(arg, t1);
        if (arg > 0) {
          t2 = this.get(arg - 1);
          if (t2 === _Frame.LONG_$LI$() || t2 === _Frame.DOUBLE_$LI$()) {
            this.set(arg - 1, _Frame.TOP_$LI$());
          } else if ((t2 & _Frame.KIND) !== _Frame.BASE) {
            this.set(arg - 1, t2 | _Frame.TOP_IF_LONG_OR_DOUBLE);
          }
        }
        break;
      case 55 /* LSTORE */:
      case 57 /* DSTORE */:
        this.pop(1);
        t1 = this.pop();
        this.set(arg, t1);
        this.set(arg + 1, _Frame.TOP_$LI$());
        if (arg > 0) {
          t2 = this.get(arg - 1);
          if (t2 === _Frame.LONG_$LI$() || t2 === _Frame.DOUBLE_$LI$()) {
            this.set(arg - 1, _Frame.TOP_$LI$());
          } else if ((t2 & _Frame.KIND) !== _Frame.BASE) {
            this.set(arg - 1, t2 | _Frame.TOP_IF_LONG_OR_DOUBLE);
          }
        }
        break;
      case 79 /* IASTORE */:
      case 84 /* BASTORE */:
      case 85 /* CASTORE */:
      case 86 /* SASTORE */:
      case 81 /* FASTORE */:
      case 83 /* AASTORE */:
        this.pop(3);
        break;
      case 80 /* LASTORE */:
      case 82 /* DASTORE */:
        this.pop(4);
        break;
      case 87 /* POP */:
      case 153 /* IFEQ */:
      case 154 /* IFNE */:
      case 155 /* IFLT */:
      case 156 /* IFGE */:
      case 157 /* IFGT */:
      case 158 /* IFLE */:
      case 172 /* IRETURN */:
      case 174 /* FRETURN */:
      case 176 /* ARETURN */:
      case 170 /* TABLESWITCH */:
      case 171 /* LOOKUPSWITCH */:
      case 191 /* ATHROW */:
      case 194 /* MONITORENTER */:
      case 195 /* MONITOREXIT */:
      case 198 /* IFNULL */:
      case 199 /* IFNONNULL */:
        this.pop(1);
        break;
      case 88 /* POP2 */:
      case 159 /* IF_ICMPEQ */:
      case 160 /* IF_ICMPNE */:
      case 161 /* IF_ICMPLT */:
      case 162 /* IF_ICMPGE */:
      case 163 /* IF_ICMPGT */:
      case 164 /* IF_ICMPLE */:
      case 165 /* IF_ACMPEQ */:
      case 166 /* IF_ACMPNE */:
      case 173 /* LRETURN */:
      case 175 /* DRETURN */:
        this.pop(2);
        break;
      case 89 /* DUP */:
        t1 = this.pop();
        this.push(t1);
        this.push(t1);
        break;
      case 90 /* DUP_X1 */:
        t1 = this.pop();
        t2 = this.pop();
        this.push(t1);
        this.push(t2);
        this.push(t1);
        break;
      case 91 /* DUP_X2 */:
        t1 = this.pop();
        t2 = this.pop();
        t3 = this.pop();
        this.push(t1);
        this.push(t3);
        this.push(t2);
        this.push(t1);
        break;
      case 92 /* DUP2 */:
        t1 = this.pop();
        t2 = this.pop();
        this.push(t2);
        this.push(t1);
        this.push(t2);
        this.push(t1);
        break;
      case 93 /* DUP2_X1 */:
        t1 = this.pop();
        t2 = this.pop();
        t3 = this.pop();
        this.push(t2);
        this.push(t1);
        this.push(t3);
        this.push(t2);
        this.push(t1);
        break;
      case 94 /* DUP2_X2 */:
        t1 = this.pop();
        t2 = this.pop();
        t3 = this.pop();
        t4 = this.pop();
        this.push(t2);
        this.push(t1);
        this.push(t4);
        this.push(t3);
        this.push(t2);
        this.push(t1);
        break;
      case 95 /* SWAP */:
        t1 = this.pop();
        t2 = this.pop();
        this.push(t1);
        this.push(t2);
        break;
      case 96 /* IADD */:
      case 100 /* ISUB */:
      case 104 /* IMUL */:
      case 108 /* IDIV */:
      case 112 /* IREM */:
      case 126 /* IAND */:
      case 128 /* IOR */:
      case 130 /* IXOR */:
      case 120 /* ISHL */:
      case 122 /* ISHR */:
      case 124 /* IUSHR */:
      case 136 /* L2I */:
      case 142 /* D2I */:
      case 149 /* FCMPL */:
      case 150 /* FCMPG */:
        this.pop(2);
        this.push(_Frame.INTEGER_$LI$());
        break;
      case 97 /* LADD */:
      case 101 /* LSUB */:
      case 105 /* LMUL */:
      case 109 /* LDIV */:
      case 113 /* LREM */:
      case 127 /* LAND */:
      case 129 /* LOR */:
      case 131 /* LXOR */:
        this.pop(4);
        this.push(_Frame.LONG_$LI$());
        this.push(_Frame.TOP_$LI$());
        break;
      case 98 /* FADD */:
      case 102 /* FSUB */:
      case 106 /* FMUL */:
      case 110 /* FDIV */:
      case 114 /* FREM */:
      case 137 /* L2F */:
      case 144 /* D2F */:
        this.pop(2);
        this.push(_Frame.FLOAT_$LI$());
        break;
      case 99 /* DADD */:
      case 103 /* DSUB */:
      case 107 /* DMUL */:
      case 111 /* DDIV */:
      case 115 /* DREM */:
        this.pop(4);
        this.push(_Frame.DOUBLE_$LI$());
        this.push(_Frame.TOP_$LI$());
        break;
      case 121 /* LSHL */:
      case 123 /* LSHR */:
      case 125 /* LUSHR */:
        this.pop(3);
        this.push(_Frame.LONG_$LI$());
        this.push(_Frame.TOP_$LI$());
        break;
      case 132 /* IINC */:
        this.set(arg, _Frame.INTEGER_$LI$());
        break;
      case 133 /* I2L */:
      case 140 /* F2L */:
        this.pop(1);
        this.push(_Frame.LONG_$LI$());
        this.push(_Frame.TOP_$LI$());
        break;
      case 134 /* I2F */:
        this.pop(1);
        this.push(_Frame.FLOAT_$LI$());
        break;
      case 135 /* I2D */:
      case 141 /* F2D */:
        this.pop(1);
        this.push(_Frame.DOUBLE_$LI$());
        this.push(_Frame.TOP_$LI$());
        break;
      case 139 /* F2I */:
      case 190 /* ARRAYLENGTH */:
      case 193 /* INSTANCEOF */:
        this.pop(1);
        this.push(_Frame.INTEGER_$LI$());
        break;
      case 148 /* LCMP */:
      case 151 /* DCMPL */:
      case 152 /* DCMPG */:
        this.pop(4);
        this.push(_Frame.INTEGER_$LI$());
        break;
      case 168 /* JSR */:
      case 169 /* RET */:
        throw new Error("JSR/RET are not supported with computeFrames option");
      case 178 /* GETSTATIC */:
        assert(item);
        this.push(cw, item.strVal3);
        break;
      case 179 /* PUTSTATIC */:
        assert(item);
        this.pop(item.strVal3);
        break;
      case 180 /* GETFIELD */:
        assert(item);
        this.pop(1);
        this.push(cw, item.strVal3);
        break;
      case 181 /* PUTFIELD */:
        assert(item);
        this.pop(item.strVal3);
        this.pop();
        break;
      case 182 /* INVOKEVIRTUAL */:
      case 183 /* INVOKESPECIAL */:
      case 184 /* INVOKESTATIC */:
      case 185 /* INVOKEINTERFACE */:
        assert(item);
        this.pop(item.strVal3);
        if (opcode !== 184 /* INVOKESTATIC */) {
          t1 = this.pop();
          if (opcode === 183 /* INVOKESPECIAL */ && item.strVal2.charAt(0) === "<") {
            this.init(t1);
          }
        }
        this.push(cw, item.strVal3);
        break;
      case 186 /* INVOKEDYNAMIC */:
        assert(item);
        this.pop(item.strVal2);
        this.push(cw, item.strVal2);
        break;
      case 187 /* NEW */:
        assert(item);
        assert(cw);
        this.push(_Frame.UNINITIALIZED_$LI$() | cw.addUninitializedType(item.strVal1, arg));
        break;
      case 188 /* NEWARRAY */:
        this.pop();
        switch (arg) {
          case 4 /* T_BOOLEAN */:
            this.push(_Frame.ARRAY_OF | _Frame.BOOLEAN_$LI$());
            break;
          case 5 /* T_CHAR */:
            this.push(_Frame.ARRAY_OF | _Frame.CHAR_$LI$());
            break;
          case 8 /* T_BYTE */:
            this.push(_Frame.ARRAY_OF | _Frame.BYTE_$LI$());
            break;
          case 9 /* T_SHORT */:
            this.push(_Frame.ARRAY_OF | _Frame.SHORT_$LI$());
            break;
          case 10 /* T_INT */:
            this.push(_Frame.ARRAY_OF | _Frame.INTEGER_$LI$());
            break;
          case 6 /* T_FLOAT */:
            this.push(_Frame.ARRAY_OF | _Frame.FLOAT_$LI$());
            break;
          case 7 /* T_DOUBLE */:
            this.push(_Frame.ARRAY_OF | _Frame.DOUBLE_$LI$());
            break;
          default:
            this.push(_Frame.ARRAY_OF | _Frame.LONG_$LI$());
            break;
        }
        break;
      case 189 /* ANEWARRAY */:
        assert(item);
        assert(cw);
        let s = item.strVal1;
        this.pop();
        if (s.charAt(0) === "[") {
          this.push(cw, "[" + s);
        } else {
          this.push(_Frame.ARRAY_OF | _Frame.OBJECT_$LI$() | cw.addType(s));
        }
        break;
      case 192 /* CHECKCAST */:
        assert(item);
        s = item.strVal1;
        this.pop();
        if (s.charAt(0) === "[") {
          this.push(cw, s);
        } else {
          assert(cw);
          this.push(_Frame.OBJECT_$LI$() | cw.addType(s));
        }
        break;
      default:
        assert(item);
        this.pop(arg);
        this.push(cw, item.strVal1);
        break;
    }
  }
  /**
     * Merges the input frame of the given basic block with the input and output
     * frames of this basic block. Returns <tt>true</tt> if the input frame of
     * the given label has been changed by this operation.
     *
     * @param cw
     * the ClassWriter to which this label belongs.
     * @param frame
     * the basic block whose input frame must be updated.
     * @param edge
     * the kind of the {@link Edge} between this label and 'label'.
     * See {@link Edge#info}.
     * @return <tt>true</tt> if the input frame of the given label has been
     * changed by this operation.
     */
  merge(cw, frame, edge) {
    let changed = false;
    let i;
    let s;
    let dim;
    let kind;
    let t;
    const nLocal = this.inputLocals.length;
    const nStack = this.inputStack.length;
    if (frame.inputLocals == null) {
      frame.inputLocals = new Array(nLocal);
      changed = true;
    }
    for (i = 0; i < nLocal; ++i) {
      if (this.outputLocals != null && i < this.outputLocals.length) {
        s = this.outputLocals[i];
        if (s === 0) {
          t = this.inputLocals[i];
        } else {
          dim = s & _Frame.DIM;
          kind = s & _Frame.KIND;
          if (kind === _Frame.BASE) {
            t = s;
          } else {
            if (kind === _Frame.LOCAL) {
              t = dim + this.inputLocals[s & _Frame.VALUE];
            } else {
              t = dim + this.inputStack[nStack - (s & _Frame.VALUE)];
            }
            if ((s & _Frame.TOP_IF_LONG_OR_DOUBLE) !== 0 && (t === _Frame.LONG_$LI$() || t === _Frame.DOUBLE_$LI$())) {
              t = _Frame.TOP_$LI$();
            }
          }
        }
      } else {
        t = this.inputLocals[i];
      }
      if (this.initializations != null) {
        t = this.init(cw, t);
      }
      changed = changed || _Frame.merge(cw, t, frame.inputLocals, i);
    }
    if (edge > 0) {
      for (i = 0; i < nLocal; ++i) {
        t = this.inputLocals[i];
        changed = changed || _Frame.merge(cw, t, frame.inputLocals, i);
      }
      if (frame.inputStack == null) {
        frame.inputStack = new Array(1);
        changed = true;
      }
      changed = changed || _Frame.merge(cw, edge, frame.inputStack, 0);
      return changed;
    }
    const nInputStack = this.inputStack.length + this.owner.inputStackTop;
    if (frame.inputStack == null) {
      frame.inputStack = new Array(nInputStack + this.outputStackTop);
      changed = true;
    }
    for (i = 0; i < nInputStack; ++i) {
      t = this.inputStack[i];
      if (this.initializations != null) {
        t = this.init(cw, t);
      }
      changed = changed || _Frame.merge(cw, t, frame.inputStack, i);
    }
    for (i = 0; i < this.outputStackTop; ++i) {
      s = this.outputStack[i];
      dim = s & _Frame.DIM;
      kind = s & _Frame.KIND;
      if (kind === _Frame.BASE) {
        t = s;
      } else {
        if (kind === _Frame.LOCAL) {
          t = dim + this.inputLocals[s & _Frame.VALUE];
        } else {
          t = dim + this.inputStack[nStack - (s & _Frame.VALUE)];
        }
        if ((s & _Frame.TOP_IF_LONG_OR_DOUBLE) !== 0 && (t === _Frame.LONG_$LI$() || t === _Frame.DOUBLE_$LI$())) {
          t = _Frame.TOP_$LI$();
        }
      }
      if (this.initializations != null) {
        t = this.init(cw, t);
      }
      changed = changed || _Frame.merge(cw, t, frame.inputStack, nInputStack + i);
    }
    return changed;
  }
  /**
     * Merges the type at the given index in the given type array with the given
     * type. Returns <tt>true</tt> if the type array has been modified by this
     * operation.
     *
     * @param cw
     * the ClassWriter to which this label belongs.
     * @param t
     * the type with which the type array element must be merged.
     * @param types
     * an array of types.
     * @param index
     * the index of the type that must be merged in 'types'.
     * @return <tt>true</tt> if the type array has been modified by this
     * operation.
     */
  static merge(cw, t, types, index) {
    const u = types[index];
    if (u === t) {
      return false;
    }
    if ((t & ~_Frame.DIM) === _Frame.NULL_$LI$()) {
      if (u === _Frame.NULL_$LI$()) {
        return false;
      }
      t = _Frame.NULL_$LI$();
    }
    if (u === 0) {
      types[index] = t;
      return true;
    }
    let v;
    if ((u & _Frame.BASE_KIND) === _Frame.OBJECT_$LI$() || (u & _Frame.DIM) !== 0) {
      if (t === _Frame.NULL_$LI$()) {
        return false;
      } else if ((t & (_Frame.DIM | _Frame.BASE_KIND)) === (u & (_Frame.DIM | _Frame.BASE_KIND))) {
        if ((u & _Frame.BASE_KIND) === _Frame.OBJECT_$LI$()) {
          v = t & _Frame.DIM | _Frame.OBJECT_$LI$() | cw.getMergedType(t & _Frame.BASE_VALUE, u & _Frame.BASE_VALUE);
        } else {
          const vdim = _Frame.ELEMENT_OF + (u & _Frame.DIM);
          v = vdim | _Frame.OBJECT_$LI$() | cw.addType("java/lang/Object");
        }
      } else if ((t & _Frame.BASE_KIND) === _Frame.OBJECT_$LI$() || (t & _Frame.DIM) !== 0) {
        const tdim = ((t & _Frame.DIM) === 0 || (t & _Frame.BASE_KIND) === _Frame.OBJECT_$LI$() ? 0 : _Frame.ELEMENT_OF) + (t & _Frame.DIM);
        const udim = ((u & _Frame.DIM) === 0 || (u & _Frame.BASE_KIND) === _Frame.OBJECT_$LI$() ? 0 : _Frame.ELEMENT_OF) + (u & _Frame.DIM);
        v = Math.min(tdim, udim) | _Frame.OBJECT_$LI$() | cw.addType("java/lang/Object");
      } else {
        v = _Frame.TOP_$LI$();
      }
    } else if (u === _Frame.NULL_$LI$()) {
      v = (t & _Frame.BASE_KIND) === _Frame.OBJECT_$LI$() || (t & _Frame.DIM) !== 0 ? t : _Frame.TOP_$LI$();
    } else {
      v = _Frame.TOP_$LI$();
    }
    if (u !== v) {
      types[index] = v;
      return true;
    }
    return false;
  }
};
var Frame = _Frame;
__publicField(Frame, "__static_initialized", false);
/**
   * Mask to get the dimension of a frame type. This dimension is a signed
   * integer between -8 and 7.
   */
__publicField(Frame, "DIM", -268435456);
/**
   * Constant to be added to a type to get a type with one more dimension.
   */
__publicField(Frame, "ARRAY_OF", 268435456);
/**
   * Constant to be added to a type to get a type with one less dimension.
   */
__publicField(Frame, "ELEMENT_OF", -268435456);
/**
   * Mask to get the kind of a frame type.
   *
   * @see #BASE
   * @see #LOCAL
   * @see #STACK
   */
__publicField(Frame, "KIND", 251658240);
/**
   * Flag used for LOCAL and STACK types. Indicates that if this type happens
   * to be a long or double type (during the computations of input frames),
   * then it must be set to TOP because the second word of this value has been
   * reused to store other data in the basic block. Hence the first word no
   * longer stores a valid long or double value.
   */
__publicField(Frame, "TOP_IF_LONG_OR_DOUBLE", 8388608);
/**
   * Mask to get the value of a frame type.
   */
__publicField(Frame, "VALUE", 8388607);
/**
   * Mask to get the kind of base types.
   */
__publicField(Frame, "BASE_KIND", 267386880);
/**
   * Mask to get the value of base types.
   */
__publicField(Frame, "BASE_VALUE", 1048575);
/**
   * Kind of the types that are not relative to an input stack map frame.
   */
__publicField(Frame, "BASE", 16777216);
/**
   * Base kind of the base reference types. The BASE_VALUE of such types is an
   * index into the type table.
   */
__publicField(Frame, "OBJECT");
/**
   * Base kind of the uninitialized base types. The BASE_VALUE of such types
   * in an index into the type table (the Item at that index contains both an
   * instruction offset and an internal class name).
   */
__publicField(Frame, "UNINITIALIZED");
/**
   * Kind of the types that are relative to the local variable types of an
   * input stack map frame. The value of such types is a local variable index.
   */
__publicField(Frame, "LOCAL", 33554432);
/**
   * Kind of the the types that are relative to the stack of an input stack
   * map frame. The value of such types is a position relatively to the top of
   * this stack.
   */
__publicField(Frame, "STACK", 50331648);
/**
   * The TOP type. This is a BASE type.
   */
__publicField(Frame, "TOP");
/**
   * The BOOLEAN type. This is a BASE type mainly used for array types.
   */
__publicField(Frame, "BOOLEAN");
/**
   * The BYTE type. This is a BASE type mainly used for array types.
   */
__publicField(Frame, "BYTE");
/**
   * The CHAR type. This is a BASE type mainly used for array types.
   */
__publicField(Frame, "CHAR");
/**
   * The SHORT type. This is a BASE type mainly used for array types.
   */
__publicField(Frame, "SHORT");
/**
   * The INTEGER type. This is a BASE type.
   */
__publicField(Frame, "INTEGER");
/**
   * The FLOAT type. This is a BASE type.
   */
__publicField(Frame, "FLOAT");
/**
   * The DOUBLE type. This is a BASE type.
   */
__publicField(Frame, "DOUBLE");
/**
   * The LONG type. This is a BASE type.
   */
__publicField(Frame, "LONG");
/**
   * The NULL type. This is a BASE type.
   */
__publicField(Frame, "NULL");
/**
   * The UNINITIALIZED_THIS type. This is a BASE type.
   */
__publicField(Frame, "UNINITIALIZED_THIS");
/**
   * The stack size variation corresponding to each JVM instruction. This
   * stack variation is equal to the size of the values produced by an
   * instruction, minus the size of the values consumed by this instruction.
   */
__publicField(Frame, "SIZE");
Frame.SIZE_$LI$();
Frame.UNINITIALIZED_THIS_$LI$();
Frame.NULL_$LI$();
Frame.LONG_$LI$();
Frame.DOUBLE_$LI$();
Frame.FLOAT_$LI$();
Frame.INTEGER_$LI$();
Frame.SHORT_$LI$();
Frame.CHAR_$LI$();
Frame.BYTE_$LI$();
Frame.BOOLEAN_$LI$();
Frame.TOP_$LI$();
Frame.UNINITIALIZED_$LI$();
Frame.OBJECT_$LI$();
Frame.__static_initialize();

// libs/Edge.ts
var Edge = class {
  constructor() {
    /**
       * Information about this control flow graph edge. If
       * {@link ClassWriter#COMPUTE_MAXS} is used this field is the (relative)
       * stack size in the basic block from which this edge originates. This size
       * is equal to the stack size at the "jump" instruction to which this edge
       * corresponds, relatively to the stack size at the beginning of the
       * originating basic block. If {@link ClassWriter#COMPUTE_FRAMES} is used,
       * this field is the kind of this control flow graph edge (i.e. NORMAL or
       * EXCEPTION).
       */
    __publicField(this, "info", 0);
    /**
       * The successor block of the basic block from which this edge originates.
       */
    __publicField(this, "successor");
    /**
       * The next edge in the list of successors of the originating basic block.
       * See {@link Label#successors successors}.
       */
    __publicField(this, "next", null);
    this.info = 0;
  }
};
/**
   * Denotes a normal control flow graph edge.
   */
__publicField(Edge, "NORMAL", 0);
/**
   * Denotes a control flow graph edge corresponding to an exception handler.
   * More precisely any {@link Edge} whose {@link #info} is strictly positive
   * corresponds to an exception handler. The actual value of {@link #info} is
   * the index, in the {@link ClassWriter} type table, of the exception that
   * is catched.
   */
__publicField(Edge, "EXCEPTION", 2147483647);

// libs/Label.ts
var _Label = class {
  /**
     * Constructs a new label.
     */
  constructor() {
    /**
       * Field used to associate user information to a label. Warning: this field
       * is used by the ASM tree package. In order to use it with the ASM tree
       * package you must override the
       * {@link org.objectweb.asm.tree.MethodNode#getLabelNode} method.
       */
    __publicField(this, "info");
    /**
       * Flags that indicate the status of this label.
       *
       * @see #DEBUG
       * @see #RESOLVED
       * @see #RESIZED
       * @see #PUSHED
       * @see #TARGET
       * @see #STORE
       * @see #REACHABLE
       * @see #JSR
       * @see #RET
       */
    __publicField(this, "status");
    /**
       * The line number corresponding to this label, if known. If there are
       * several lines, each line is stored in a separate label, all linked via
       * their next field (these links are created in ClassReader and removed just
       * before visitLabel is called, so that this does not impact the rest of the
       * code).
       */
    __publicField(this, "line");
    /**
       * The position of this label in the code, if known.
       */
    __publicField(this, "position");
    /**
       * Number of forward references to this label, times two.
       */
    __publicField(this, "referenceCount");
    /**
       * Informations about forward references. Each forward reference is
       * described by two consecutive integers in this array: the first one is the
       * position of the first byte of the bytecode instruction that contains the
       * forward reference, while the second is the position of the first byte of
       * the forward reference itself. In fact the sign of the first integer
       * indicates if this reference uses 2 or 4 bytes, and its absolute value
       * gives the position of the bytecode instruction. This array is also used
       * as a bitset to store the subroutines to which a basic block belongs. This
       * information is needed in {@linked MethodWriter#visitMaxs}, after all
       * forward references have been resolved. Hence the same array can be used
       * for both purposes without problems.
       */
    __publicField(this, "srcAndRefPositions", null);
    /**
       * Start of the output stack relatively to the input stack. The exact
       * semantics of this field depends on the algorithm that is used.
       *
       * When only the maximum stack size is computed, this field is the number of
       * elements in the input stack.
       *
       * When the stack map frames are completely computed, this field is the
       * offset of the first output stack element relatively to the top of the
       * input stack. This offset is always negative or null. A null offset means
       * that the output stack must be appended to the input stack. A -n offset
       * means that the first n output stack elements must replace the top n input
       * stack elements, and that the other elements must be appended to the input
       * stack.
       */
    __publicField(this, "inputStackTop");
    /**
       * Maximum height reached by the output stack, relatively to the top of the
       * input stack. This maximum is always positive or null.
       */
    __publicField(this, "outputStackMax");
    /**
       * Information about the input and output stack map frames of this basic
       * block. This field is only used when {@link ClassWriter#COMPUTE_FRAMES}
       * option is used.
       */
    __publicField(this, "frame", null);
    /**
       * The successor of this label, in the order they are visited. This linked
       * list does not include labels used for debug info only. If
       * {@link ClassWriter#COMPUTE_FRAMES} option is used then, in addition, it
       * does not contain successive labels that denote the same bytecode position
       * (in this case only the first label appears in this list).
       */
    __publicField(this, "successor");
    /**
       * The successors of this node in the control flow graph. These successors
       * are stored in a linked list of {@link Edge Edge} objects, linked to each
       * other by their {@link Edge#next} field.
       */
    __publicField(this, "successors");
    /**
       * The next basic block in the basic block stack. This stack is used in the
       * main loop of the fix point algorithm used in the second step of the
       * control flow analysis algorithms. It is also used in
       * {@link #visitSubroutine} to avoid using a recursive method, and in
       * ClassReader to temporarily store multiple source lines for a label.
       *
       * @see MethodWriter#visitMaxs
       */
    __publicField(this, "next", null);
    this.status = 0;
    this.line = 0;
    this.position = 0;
    this.referenceCount = 0;
    this.inputStackTop = 0;
    this.outputStackMax = 0;
  }
  /**
     * Returns the offset corresponding to this label. This offset is computed
     * from the start of the method's bytecode. <i>This method is intended for
     * {@link Attribute} sub classes, and is normally not needed by class
     * generators or adapters.</i>
     *
     * @return the offset corresponding to this label.
     * @throws IllegalStateException
     * if this label is not resolved yet.
     */
  getOffset() {
    if ((this.status & _Label.RESOLVED) === 0) {
      throw new Error("Label offset position has not been resolved yet");
    }
    return this.position;
  }
  /**
     * Puts a reference to this label in the bytecode of a method. If the
     * position of the label is known, the offset is computed and written
     * directly. Otherwise, a null offset is written and a new forward reference
     * is declared for this label.
     *
     * @param owner
     * the code writer that calls this method.
     * @param out
     * the bytecode of the method.
     * @param source
     * the position of first byte of the bytecode instruction that
     * contains this label.
     * @param wideOffset
     * <tt>true</tt> if the reference must be stored in 4 bytes, or
     * <tt>false</tt> if it must be stored with 2 bytes.
     * @throws IllegalArgumentException
     * if this label has not been created by the given code writer.
     */
  put(owner, out, source, wideOffset) {
    if ((this.status & _Label.RESOLVED) === 0) {
      if (wideOffset) {
        this.addReference(-1 - source, out.length);
        out.putInt(-1);
      } else {
        this.addReference(source, out.length);
        out.putShort(-1);
      }
    } else {
      if (wideOffset) {
        out.putInt(this.position - source);
      } else {
        out.putShort(this.position - source);
      }
    }
  }
  /**
     * Adds a forward reference to this label. This method must be called only
     * for a true forward reference, i.e. only if this label is not resolved
     * yet. For backward references, the offset of the reference can be, and
     * must be, computed and stored directly.
     *
     * @param sourcePosition
     * the position of the referencing instruction. This position
     * will be used to compute the offset of this forward reference.
     * @param referencePosition
     * the position where the offset for this forward reference must
     * be stored.
     */
  addReference(sourcePosition, referencePosition) {
    if (this.srcAndRefPositions == null) {
      this.srcAndRefPositions = new Array(6);
    }
    if (this.referenceCount >= this.srcAndRefPositions.length) {
      const a = new Array(this.srcAndRefPositions.length + 6);
      a.concat(this.srcAndRefPositions);
      this.srcAndRefPositions = a;
    }
    this.srcAndRefPositions[this.referenceCount++] = sourcePosition;
    this.srcAndRefPositions[this.referenceCount++] = referencePosition;
  }
  /**
     * Resolves all forward references to this label. This method must be called
     * when this label is added to the bytecode of the method, i.e. when its
     * position becomes known. This method fills in the blanks that where left
     * in the bytecode by each forward reference previously added to this label.
     *
     * @param owner
     * the code writer that calls this method.
     * @param position
     * the position of this label in the bytecode.
     * @param data
     * the bytecode of the method.
     * @return <tt>true</tt> if a blank that was left for this label was to
     * small to store the offset. In such a case the corresponding jump
     * instruction is replaced with a pseudo instruction (using unused
     * opcodes) using an unsigned two bytes offset. These pseudo
     * instructions will be replaced with standard bytecode instructions
     * with wider offsets (4 bytes instead of 2), in ClassReader.
     * @throws IllegalArgumentException
     * if this label has already been resolved, or if it has not
     * been created by the given code writer.
     */
  resolve(owner, position, data) {
    assert(this.srcAndRefPositions);
    let needUpdate = false;
    this.status |= _Label.RESOLVED;
    this.position = position;
    let i = 0;
    while (i < this.referenceCount) {
      const source = this.srcAndRefPositions[i++];
      let reference = this.srcAndRefPositions[i++];
      let offset;
      if (source >= 0) {
        offset = position - source;
        if (offset < SHORT_MIN || offset > SHORT_MAX) {
          const opcode = data[reference - 1] & 255;
          if (opcode <= 168 /* JSR */) {
            data[reference - 1] = opcode + 49 | 0;
          } else {
            data[reference - 1] = opcode + 20 | 0;
          }
          needUpdate = true;
        }
        data[reference++] = offset >>> 8 | 0;
        data[reference] = offset | 0;
      } else {
        offset = position + source + 1;
        data[reference++] = offset >>> 24 | 0;
        data[reference++] = offset >>> 16 | 0;
        data[reference++] = offset >>> 8 | 0;
        data[reference] = offset | 0;
      }
    }
    return needUpdate;
  }
  /**
     * Returns the first label of the series to which this label belongs. For an
     * isolated label or for the first label in a series of successive labels,
     * this method returns the label itself. For other labels it returns the
     * first label of the series.
     *
     * @return the first label of the series to which this label belongs.
     */
  getFirst() {
    return !ClassReader.FRAMES || this.frame == null ? this : this.frame.owner;
  }
  /**
     * Returns true is this basic block belongs to the given subroutine.
     *
     * @param id
     * a subroutine id.
     * @return true is this basic block belongs to the given subroutine.
     */
  inSubroutine(id) {
    assert(this.srcAndRefPositions);
    if ((this.status & _Label.VISITED) !== 0) {
      return (this.srcAndRefPositions[id >>> 32 | 0] & (id | 0)) !== 0;
    }
    return false;
  }
  /**
     * Returns true if this basic block and the given one belong to a common
     * subroutine.
     *
     * @param block
     * another basic block.
     * @return true if this basic block and the given one belong to a common
     * subroutine.
     */
  inSameSubroutine(block) {
    if ((this.status & _Label.VISITED) === 0 || (block.status & _Label.VISITED) === 0) {
      return false;
    }
    assert(this.srcAndRefPositions);
    assert(block.srcAndRefPositions);
    for (let i = 0; i < this.srcAndRefPositions.length; ++i) {
      if ((this.srcAndRefPositions[i] & block.srcAndRefPositions[i]) !== 0) {
        return true;
      }
    }
    return false;
  }
  /**
     * Marks this basic block as belonging to the given subroutine.
     *
     * @param id
     * a subroutine id.
     * @param nbSubroutines
     * the total number of subroutines in the method.
     */
  addToSubroutine(id, nbSubroutines) {
    assert(this.srcAndRefPositions);
    if ((this.status & _Label.VISITED) === 0) {
      this.status |= _Label.VISITED;
      this.srcAndRefPositions = new Array((nbSubroutines / 32 | 0) + 1);
    }
    this.srcAndRefPositions[id >>> 32 | 0] |= id | 0;
  }
  /**
     * Finds the basic blocks that belong to a given subroutine, and marks these
     * blocks as belonging to this subroutine. This method follows the control
     * flow graph to find all the blocks that are reachable from the current
     * block WITHOUT following any JSR target.
     *
     * @param JSR
     * a JSR block that jumps to this subroutine. If this JSR is not
     * null it is added to the successor of the RET blocks found in
     * the subroutine.
     * @param id
     * the id of this subroutine.
     * @param nbSubroutines
     * the total number of subroutines in the method.
     */
  visitSubroutine(JSR, id, nbSubroutines) {
    let stack = this;
    while (stack != null) {
      const l = stack;
      stack = l.next;
      l.next = null;
      if (JSR != null) {
        if ((l.status & _Label.VISITED2) !== 0) {
          continue;
        }
        l.status |= _Label.VISITED2;
        if ((l.status & _Label.RET) !== 0) {
          if (!l.inSameSubroutine(JSR)) {
            const e2 = new Edge();
            e2.info = l.inputStackTop;
            e2.successor = JSR.successors.successor;
            e2.next = l.successors;
            l.successors = e2;
          }
        }
      } else {
        if (l.inSubroutine(id)) {
          continue;
        }
        l.addToSubroutine(id, nbSubroutines);
      }
      let e = l.successors;
      while (e != null) {
        if ((l.status & _Label.JSR) === 0 || l.successors && e !== l.successors.next) {
          if (e.successor && e.successor.next == null) {
            e.successor.next = stack;
            stack = e.successor;
          }
        }
        e = e.next;
      }
    }
  }
  /**
     * Returns a string representation of this label.
     *
     * @return a string representation of this label.
     */
  toString() {
    return "Lable";
  }
};
var Label = _Label;
/**
   * Indicates if this label is only used for debug attributes. Such a label
   * is not the start of a basic block, the target of a jump instruction, or
   * an exception handler. It can be safely ignored in control flow graph
   * analysis algorithms (for optimization purposes).
   */
__publicField(Label, "DEBUG", 1);
/**
   * Indicates if the position of this label is known.
   */
__publicField(Label, "RESOLVED", 2);
/**
   * Indicates if this label has been updated, after instruction resizing.
   */
__publicField(Label, "RESIZED", 4);
/**
   * Indicates if this basic block has been pushed in the basic block stack.
   * See {@link MethodWriter#visitMaxs visitMaxs}.
   */
__publicField(Label, "PUSHED", 8);
/**
   * Indicates if this label is the target of a jump instruction, or the start
   * of an exception handler.
   */
__publicField(Label, "TARGET", 16);
/**
   * Indicates if a stack map frame must be stored for this label.
   */
__publicField(Label, "STORE", 32);
/**
   * Indicates if this label corresponds to a reachable basic block.
   */
__publicField(Label, "REACHABLE", 64);
/**
   * Indicates if this basic block ends with a JSR instruction.
   */
__publicField(Label, "JSR", 128);
/**
   * Indicates if this basic block ends with a RET instruction.
   */
__publicField(Label, "RET", 256);
/**
   * Indicates if this basic block is the start of a subroutine.
   */
__publicField(Label, "SUBROUTINE", 512);
/**
   * Indicates if this subroutine basic block has been visited by a
   * visitSubroutine(null, ...) call.
   */
__publicField(Label, "VISITED", 1024);
/**
   * Indicates if this subroutine basic block has been visited by a
   * visitSubroutine(!null, ...) call.
   */
__publicField(Label, "VISITED2", 2048);

// libs/CurrentFrame.ts
var CurrentFrame = class extends Frame {
  /**
     * Sets this CurrentFrame to the input stack map frame of the next "current"
     * instruction, i.e. the instruction just after the given one. It is assumed
     * that the value of this object when this method is called is the stack map
     * frame status just before the given instruction is executed.
     */
  execute(opcode, arg, cw, item) {
    super.execute(opcode, arg, cw, item);
    const successor = new Frame(null);
    this.merge(cw, successor, 0);
    this.set$Frame(successor);
    this.owner.inputStackTop = 0;
  }
};

// libs/MethodWriter.ts
var _MethodWriter = class extends MethodVisitor {
  /**
     * Constructs a new {@link MethodWriter}.
     *
     * @param cw
     * the class writer in which the method must be added.
     * @param access
     * the method's access flags (see {@link Opcodes}).
     * @param name
     * the method's name.
     * @param desc
     * the method's descriptor (see {@link Type}).
     * @param signature
     * the method's signature. May be <tt>null</tt>.
     * @param exceptions
     * the internal names of the method's exceptions. May be
     * <tt>null</tt>.
     * @param compute
     * Indicates what must be automatically computed (see #compute).
     */
  constructor(cw, access, name, desc, signature, exceptions, compute) {
    super(327680 /* ASM5 */);
    /**
       * The class writer to which this method must be added.
       */
    __publicField(this, "cw");
    /**
       * Access flags of this method.
       */
    __publicField(this, "access");
    /**
       * The index of the constant pool item that contains the name of this
       * method.
       */
    __publicField(this, "name");
    /**
       * The index of the constant pool item that contains the descriptor of this
       * method.
       */
    __publicField(this, "desc");
    /**
       * The descriptor of this method.
       */
    __publicField(this, "descriptor");
    /**
       * The signature of this method.
       */
    __publicField(this, "signature", null);
    /**
       * If not zero, indicates that the code of this method must be copied from
       * the ClassReader associated to this writer in <code>cw.cr</code>. More
       * precisely, this field gives the index of the first byte to copied from
       * <code>cw.cr.b</code>.
       */
    __publicField(this, "classReaderOffset");
    /**
       * If not zero, indicates that the code of this method must be copied from
       * the ClassReader associated to this writer in <code>cw.cr</code>. More
       * precisely, this field gives the number of bytes to copied from
       * <code>cw.cr.b</code>.
       */
    __publicField(this, "classReaderLength");
    /**
       * Number of exceptions that can be thrown by this method.
       */
    __publicField(this, "exceptionCount");
    /**
       * The exceptions that can be thrown by this method. More precisely, this
       * array contains the indexes of the constant pool items that contain the
       * internal names of these exception classes.
       */
    __publicField(this, "exceptions", null);
    /**
       * The annotation default attribute of this method. May be <tt>null</tt>.
       */
    __publicField(this, "annd", null);
    /**
       * The runtime visible annotations of this method. May be <tt>null</tt>.
       */
    __publicField(this, "anns", null);
    /**
       * The runtime invisible annotations of this method. May be <tt>null</tt>.
       */
    __publicField(this, "ianns", null);
    /**
       * The runtime visible type annotations of this method. May be <tt>null</tt>
       * .
       */
    __publicField(this, "tanns", null);
    /**
       * The runtime invisible type annotations of this method. May be
       * <tt>null</tt>.
       */
    __publicField(this, "itanns", null);
    /**
       * The runtime visible parameter annotations of this method. May be
       * <tt>null</tt>.
       */
    __publicField(this, "panns", null);
    /**
       * The runtime invisible parameter annotations of this method. May be
       * <tt>null</tt>.
       */
    __publicField(this, "ipanns", null);
    /**
       * The number of synthetic parameters of this method.
       */
    __publicField(this, "synthetics");
    /**
       * The non standard attributes of the method.
       */
    __publicField(this, "attrs", null);
    /**
       * The bytecode of this method.
       */
    __publicField(this, "code", new ByteVector());
    /**
       * Maximum stack size of this method.
       */
    __publicField(this, "maxStack");
    /**
       * Maximum number of local variables for this method.
       */
    __publicField(this, "maxLocals");
    /**
       * Number of local variables in the current stack map frame.
       */
    __publicField(this, "currentLocals");
    /**
       * Number of stack map frames in the StackMapTable attribute.
       */
    __publicField(this, "frameCount");
    /**
       * The StackMapTable attribute.
       */
    __publicField(this, "stackMap", null);
    /**
       * The offset of the last frame that was written in the StackMapTable
       * attribute.
       */
    __publicField(this, "previousFrameOffset");
    /**
       * The last frame that was written in the StackMapTable attribute.
       *
       * @see #frame
       */
    __publicField(this, "previousFrame", null);
    /**
       * The current stack map frame. The first element contains the offset of the
       * instruction to which the frame corresponds, the second element is the
       * number of locals and the third one is the number of stack elements. The
       * local variables start at index 3 and are followed by the operand stack
       * values. In summary frame[0] = offset, frame[1] = nLocal, frame[2] =
       * nStack, frame[3] = nLocal. All types are encoded as integers, with the
       * same format as the one used in {@link Label}, but limited to BASE types.
       */
    __publicField(this, "frame", null);
    /**
       * Number of elements in the exception handler list.
       */
    __publicField(this, "handlerCount");
    /**
       * The first element in the exception handler list.
       */
    __publicField(this, "firstHandler", null);
    /**
       * The last element in the exception handler list.
       */
    __publicField(this, "lastHandler", null);
    /**
       * Number of entries in the MethodParameters attribute.
       */
    __publicField(this, "methodParametersCount");
    /**
       * The MethodParameters attribute.
       */
    __publicField(this, "methodParameters", null);
    /**
       * Number of entries in the LocalVariableTable attribute.
       */
    __publicField(this, "localVarCount");
    /**
       * The LocalVariableTable attribute.
       */
    __publicField(this, "localVar", null);
    /**
       * Number of entries in the LocalVariableTypeTable attribute.
       */
    __publicField(this, "localVarTypeCount");
    /**
       * The LocalVariableTypeTable attribute.
       */
    __publicField(this, "localVarType", null);
    /**
       * Number of entries in the LineNumberTable attribute.
       */
    __publicField(this, "lineNumberCount");
    /**
       * The LineNumberTable attribute.
       */
    __publicField(this, "lineNumber", null);
    /**
       * The start offset of the last visited instruction.
       */
    __publicField(this, "lastCodeOffset");
    /**
       * The runtime visible type annotations of the code. May be <tt>null</tt>.
       */
    __publicField(this, "ctanns", null);
    /**
       * The runtime invisible type annotations of the code. May be <tt>null</tt>.
       */
    __publicField(this, "ictanns", null);
    /**
       * The non standard attributes of the method's code.
       */
    __publicField(this, "cattrs", null);
    /**
       * The number of subroutines in this method.
       */
    __publicField(this, "subroutines");
    /**
       * Indicates what must be automatically computed.
       *
       * @see #FRAMES
       * @see #INSERTED_FRAMES
       * @see #MAXS
       * @see #NOTHING
       */
    __publicField(this, "compute");
    /**
       * A list of labels. This list is the list of basic blocks in the method,
       * i.e. a list of Label objects linked to each other by their
       * {@link Label#successor} field, in the order they are visited by
       * {@link MethodVisitor#visitLabel}, and starting with the first basic
       * block.
       */
    __publicField(this, "labels", null);
    /**
       * The previous basic block.
       */
    __publicField(this, "previousBlock", null);
    /**
       * The current basic block.
       */
    __publicField(this, "currentBlock", null);
    /**
       * The (relative) stack size after the last visited instruction. This size
       * is relative to the beginning of the current basic block, i.e., the true
       * stack size after the last visited instruction is equal to the
       * {@link Label#inputStackTop beginStackSize} of the current basic block
       * plus <tt>stackSize</tt>.
       */
    __publicField(this, "stackSize");
    /**
       * The (relative) maximum stack size after the last visited instruction.
       * This size is relative to the beginning of the current basic block, i.e.,
       * the true maximum stack size after the last visited instruction is equal
       * to the {@link Label#inputStackTop beginStackSize} of the current basic
       * block plus <tt>stackSize</tt>.
       */
    __publicField(this, "maxStackSize");
    this.access = 0;
    this.name = 0;
    this.desc = 0;
    this.classReaderOffset = 0;
    this.classReaderLength = 0;
    this.exceptionCount = 0;
    this.synthetics = 0;
    this.maxStack = 0;
    this.maxLocals = 0;
    this.currentLocals = 0;
    this.frameCount = 0;
    this.previousFrameOffset = 0;
    this.handlerCount = 0;
    this.methodParametersCount = 0;
    this.localVarCount = 0;
    this.localVarTypeCount = 0;
    this.lineNumberCount = 0;
    this.lastCodeOffset = 0;
    this.subroutines = 0;
    this.compute = 0;
    this.stackSize = 0;
    this.maxStackSize = 0;
    if (cw.firstMethod == null) {
      cw.firstMethod = this;
    } else {
      cw.lastMethod.mv = this;
    }
    cw.lastMethod = this;
    this.cw = cw;
    this.access = access;
    if (name === "<init>") {
      this.access |= _MethodWriter.ACC_CONSTRUCTOR;
    }
    this.name = cw.newUTF8(name);
    this.desc = cw.newUTF8(desc);
    this.descriptor = desc;
    if (ClassReader.SIGNATURES) {
      this.signature = signature;
    }
    if (exceptions != null && exceptions.length > 0) {
      this.exceptionCount = exceptions.length;
      this.exceptions = new Array(this.exceptionCount);
      for (let i = 0; i < this.exceptionCount; ++i) {
        this.exceptions[i] = cw.newClass(exceptions[i]);
      }
    }
    this.compute = compute;
    if (compute !== _MethodWriter.NOTHING) {
      let size = Type.getArgumentsAndReturnSizes(this.descriptor) >> 2;
      if ((access & 8 /* ACC_STATIC */) !== 0) {
        --size;
      }
      this.maxLocals = size;
      this.currentLocals = size;
      this.labels = new Label();
      this.labels.status |= Label.PUSHED;
      this.visitLabel(this.labels);
    }
  }
  visitParameter(name, access) {
    if (this.methodParameters == null) {
      this.methodParameters = new ByteVector();
    }
    ++this.methodParametersCount;
    this.methodParameters.putShort(name == null ? 0 : this.cw.newUTF8(name)).putShort(access);
  }
  visitAnnotationDefault() {
    if (!ClassReader.ANNOTATIONS) {
      return null;
    }
    this.annd = new ByteVector();
    return new AnnotationWriter(this.cw, false, this.annd, null, 0);
  }
  visitAnnotation(desc, visible) {
    if (!ClassReader.ANNOTATIONS) {
      return null;
    }
    const bv = new ByteVector();
    bv.putShort(this.cw.newUTF8(desc)).putShort(0);
    const aw = new AnnotationWriter(this.cw, true, bv, bv, 2);
    if (visible) {
      aw.next = this.anns;
      this.anns = aw;
    } else {
      aw.next = this.ianns;
      this.ianns = aw;
    }
    return aw;
  }
  visitTypeAnnotation(typeRef, typePath, desc, visible) {
    if (!ClassReader.ANNOTATIONS) {
      return null;
    }
    const bv = new ByteVector();
    AnnotationWriter.putTarget(typeRef, typePath, bv);
    bv.putShort(this.cw.newUTF8(desc)).putShort(0);
    const aw = new AnnotationWriter(this.cw, true, bv, bv, bv.length - 2);
    if (visible) {
      aw.next = this.tanns;
      this.tanns = aw;
    } else {
      aw.next = this.itanns;
      this.itanns = aw;
    }
    return aw;
  }
  visitParameterAnnotation(parameter, desc, visible) {
    if (!ClassReader.ANNOTATIONS) {
      return null;
    }
    const bv = new ByteVector();
    if (desc === "Ljava/lang/Synthetic;") {
      this.synthetics = Math.max(this.synthetics, parameter + 1);
      return new AnnotationWriter(this.cw, false, bv, null, 0);
    }
    bv.putShort(this.cw.newUTF8(desc)).putShort(0);
    const aw = new AnnotationWriter(this.cw, true, bv, bv, 2);
    if (visible) {
      if (this.panns == null) {
        this.panns = new Array(Type.getArgumentTypes(this.descriptor).length);
      }
      aw.next = this.panns[parameter];
      this.panns[parameter] = aw;
    } else {
      if (this.ipanns == null) {
        this.ipanns = new Array(Type.getArgumentTypes(this.descriptor).length);
      }
      aw.next = this.ipanns[parameter];
      this.ipanns[parameter] = aw;
    }
    return aw;
  }
  visitAttribute(attr) {
    if (attr.isCodeAttribute()) {
      attr.next = this.cattrs;
      this.cattrs = attr;
    } else {
      attr.next = this.attrs;
      this.attrs = attr;
    }
  }
  visitCode() {
  }
  visitFrame(type, nLocal, local, nStack, stack) {
    assert(this.frame);
    if ((typeof type === "number" || type === null) && (typeof nLocal === "number" || nLocal === null) && (local != null && local instanceof Array || local === null) && (typeof nStack === "number" || nStack === null) && (stack != null && stack instanceof Array || stack === null)) {
      const __args = Array.prototype.slice.call(arguments);
      return (() => {
        if (!ClassReader.FRAMES || this.compute === _MethodWriter.FRAMES) {
          return;
        }
        if (this.compute === _MethodWriter.INSERTED_FRAMES) {
          if (this.currentBlock && this.currentBlock.frame == null) {
            this.currentBlock.frame = new CurrentFrame(this.currentBlock);
            this.currentBlock.frame.initInputFrame(this.cw, this.access, Type.getArgumentTypes(this.descriptor), nLocal);
            this.visitImplicitFirstFrame();
          } else {
            assert(this.currentBlock);
            if (type === -1 /* F_NEW */) {
              assert(this.currentBlock.frame);
              this.currentBlock.frame.set(this.cw, nLocal, local, nStack, stack);
            } else {
            }
            this.visitFrame(this.currentBlock.frame);
          }
        } else if (type === -1 /* F_NEW */) {
          if (this.previousFrame == null) {
            this.visitImplicitFirstFrame();
          }
          this.currentLocals = nLocal;
          let frameIndex = this.startFrame(this.code.length, nLocal, nStack);
          for (let i = 0; i < nLocal; ++i) {
            if (typeof local[i] === "string") {
              this.frame[frameIndex++] = Frame.OBJECT_$LI$() | this.cw.addType(local[i]);
            } else if (typeof local[i] === "number") {
              this.frame[frameIndex++] = /* intValue */
              local[i] | 0;
            } else {
              this.frame[frameIndex++] = Frame.UNINITIALIZED_$LI$() | this.cw.addUninitializedType("", local[i].position);
            }
          }
          for (let i = 0; i < nStack; ++i) {
            if (typeof stack[i] === "string") {
              this.frame[frameIndex++] = Frame.OBJECT_$LI$() | this.cw.addType(stack[i]);
            } else if (typeof stack[i] === "number") {
              this.frame[frameIndex++] = /* intValue */
              stack[i] | 0;
            } else {
              this.frame[frameIndex++] = Frame.UNINITIALIZED_$LI$() | this.cw.addUninitializedType("", stack[i].position);
            }
          }
          this.endFrame();
        } else {
          let delta;
          if (this.stackMap == null) {
            this.stackMap = new ByteVector();
            delta = this.code.length;
          } else {
            delta = this.code.length - this.previousFrameOffset - 1;
            if (delta < 0) {
              if (type === 3 /* F_SAME */) {
                return;
              } else {
                throw new Error();
              }
            }
          }
          switch (type) {
            case 0 /* F_FULL */:
              this.currentLocals = nLocal;
              this.stackMap.putByte(_MethodWriter.FULL_FRAME).putShort(delta).putShort(nLocal);
              for (let i = 0; i < nLocal; ++i) {
                this.writeFrameType(local[i]);
              }
              this.stackMap.putShort(nStack);
              for (let i = 0; i < nStack; ++i) {
                this.writeFrameType(stack[i]);
              }
              break;
            case 1 /* F_APPEND */:
              this.currentLocals += nLocal;
              this.stackMap.putByte(_MethodWriter.SAME_FRAME_EXTENDED + nLocal).putShort(delta);
              for (let i = 0; i < nLocal; ++i) {
                this.writeFrameType(local[i]);
              }
              break;
            case 2 /* F_CHOP */:
              this.currentLocals -= nLocal;
              this.stackMap.putByte(_MethodWriter.SAME_FRAME_EXTENDED - nLocal).putShort(delta);
              break;
            case 3 /* F_SAME */:
              if (delta < 64) {
                this.stackMap.putByte(delta);
              } else {
                this.stackMap.putByte(_MethodWriter.SAME_FRAME_EXTENDED).putShort(delta);
              }
              break;
            case 4 /* F_SAME1 */:
              if (delta < 64) {
                this.stackMap.putByte(_MethodWriter.SAME_LOCALS_1_STACK_ITEM_FRAME + delta);
              } else {
                this.stackMap.putByte(_MethodWriter.SAME_LOCALS_1_STACK_ITEM_FRAME_EXTENDED).putShort(delta);
              }
              this.writeFrameType(stack[0]);
              break;
          }
          this.previousFrameOffset = this.code.length;
          ++this.frameCount;
        }
        this.maxStack = Math.max(this.maxStack, nStack);
        this.maxLocals = Math.max(this.maxLocals, this.currentLocals);
      })();
    } else if ((type != null && type instanceof Frame || type === null) && nLocal === void 0 && local === void 0 && nStack === void 0 && stack === void 0) {
      return this.visitFrame$Frame(type);
    } else {
      throw new Error("invalid overload");
    }
  }
  visitInsn(opcode) {
    this.lastCodeOffset = this.code.length;
    this.code.putByte(opcode);
    if (this.currentBlock != null) {
      if (this.compute === _MethodWriter.FRAMES || this.compute === _MethodWriter.INSERTED_FRAMES) {
        assert(this.currentBlock.frame);
        this.currentBlock.frame.execute(opcode, 0, null, null);
      } else {
        const size = this.stackSize + Frame.SIZE_$LI$()[opcode];
        if (size > this.maxStackSize) {
          this.maxStackSize = size;
        }
        this.stackSize = size;
      }
      if (opcode >= 172 /* IRETURN */ && opcode <= 177 /* RETURN */ || opcode === 191 /* ATHROW */) {
        this.noSuccessor();
      }
    }
  }
  visitIntInsn(opcode, operand) {
    this.lastCodeOffset = this.code.length;
    if (this.currentBlock != null) {
      if (this.compute === _MethodWriter.FRAMES || this.compute === _MethodWriter.INSERTED_FRAMES) {
        assert(this.currentBlock.frame);
        this.currentBlock.frame.execute(opcode, operand, null, null);
      } else if (opcode !== 188 /* NEWARRAY */) {
        const size = this.stackSize + 1;
        if (size > this.maxStackSize) {
          this.maxStackSize = size;
        }
        this.stackSize = size;
      }
    }
    if (opcode === 17 /* SIPUSH */) {
      this.code.put12(opcode, operand);
    } else {
      this.code.put11(opcode, operand);
    }
  }
  visitVarInsn(opcode, __var) {
    this.lastCodeOffset = this.code.length;
    if (this.currentBlock != null) {
      if (this.compute === _MethodWriter.FRAMES || this.compute === _MethodWriter.INSERTED_FRAMES) {
        assert(this.currentBlock.frame);
        this.currentBlock.frame.execute(opcode, __var, null, null);
      } else {
        if (opcode === 169 /* RET */) {
          this.currentBlock.status |= Label.RET;
          this.currentBlock.inputStackTop = this.stackSize;
          this.noSuccessor();
        } else {
          const size = this.stackSize + Frame.SIZE_$LI$()[opcode];
          if (size > this.maxStackSize) {
            this.maxStackSize = size;
          }
          this.stackSize = size;
        }
      }
    }
    if (this.compute !== _MethodWriter.NOTHING) {
      let n;
      if (opcode === 22 /* LLOAD */ || opcode === 24 /* DLOAD */ || opcode === 55 /* LSTORE */ || opcode === 57 /* DSTORE */) {
        n = __var + 2;
      } else {
        n = __var + 1;
      }
      if (n > this.maxLocals) {
        this.maxLocals = n;
      }
    }
    if (__var < 4 && opcode !== 169 /* RET */) {
      let opt;
      if (opcode < 54 /* ISTORE */) {
        opt = 26 + (opcode - 21 /* ILOAD */ << 2) + __var;
      } else {
        opt = 59 + (opcode - 54 /* ISTORE */ << 2) + __var;
      }
      this.code.putByte(opt);
    } else if (__var >= 256) {
      this.code.putByte(196).put12(opcode, __var);
    } else {
      this.code.put11(opcode, __var);
    }
    if (opcode >= 54 /* ISTORE */ && this.compute === _MethodWriter.FRAMES && this.handlerCount > 0) {
      this.visitLabel(new Label());
    }
  }
  visitTypeInsn(opcode, type) {
    this.lastCodeOffset = this.code.length;
    const i = this.cw.newClassItem(type);
    if (this.currentBlock != null) {
      if (this.compute === _MethodWriter.FRAMES || this.compute === _MethodWriter.INSERTED_FRAMES) {
        assert(this.currentBlock.frame);
        this.currentBlock.frame.execute(opcode, this.code.length, this.cw, i);
      } else if (opcode === 187 /* NEW */) {
        const size = this.stackSize + 1;
        if (size > this.maxStackSize) {
          this.maxStackSize = size;
        }
        this.stackSize = size;
      }
    }
    this.code.put12(opcode, i.index);
  }
  visitFieldInsn(opcode, owner, name, desc) {
    this.lastCodeOffset = this.code.length;
    const i = this.cw.newFieldItem(owner, name, desc);
    if (this.currentBlock != null) {
      if (this.compute === _MethodWriter.FRAMES || this.compute === _MethodWriter.INSERTED_FRAMES) {
        assert(this.currentBlock.frame);
        this.currentBlock.frame.execute(opcode, 0, this.cw, i);
      } else {
        let size;
        const c = desc.charAt(0);
        switch (opcode) {
          case 178 /* GETSTATIC */:
            size = this.stackSize + (c === "D" || c === "J" ? 2 : 1);
            break;
          case 179 /* PUTSTATIC */:
            size = this.stackSize + (c === "D" || c === "J" ? -2 : -1);
            break;
          case 180 /* GETFIELD */:
            size = this.stackSize + (c === "D" || c === "J" ? 1 : 0);
            break;
          default:
            size = this.stackSize + (c === "D" || c === "J" ? -3 : -2);
            break;
        }
        if (size > this.maxStackSize) {
          this.maxStackSize = size;
        }
        this.stackSize = size;
      }
    }
    this.code.put12(opcode, i.index);
  }
  visitMethodInsn(opcode, owner, name, desc, itf) {
    if ((typeof opcode === "number" || opcode === null) && (typeof owner === "string" || owner === null) && (typeof name === "string" || name === null) && (typeof desc === "string" || desc === null) && (typeof itf === "boolean" || itf === null)) {
      const __args = Array.prototype.slice.call(arguments);
      return (() => {
        this.lastCodeOffset = this.code.length;
        const i = this.cw.newMethodItem(owner, name, desc, itf);
        let argSize = i.intVal;
        if (this.currentBlock != null) {
          if (this.compute === _MethodWriter.FRAMES || this.compute === _MethodWriter.INSERTED_FRAMES) {
            assert(this.currentBlock.frame);
            this.currentBlock.frame.execute(opcode, 0, this.cw, i);
          } else {
            if (argSize === 0) {
              argSize = Type.getArgumentsAndReturnSizes(desc);
              i.intVal = argSize;
            }
            let size;
            if (opcode === 184 /* INVOKESTATIC */) {
              size = this.stackSize - (argSize >> 2) + (argSize & 3) + 1;
            } else {
              size = this.stackSize - (argSize >> 2) + (argSize & 3);
            }
            if (size > this.maxStackSize) {
              this.maxStackSize = size;
            }
            this.stackSize = size;
          }
        }
        if (opcode === 185 /* INVOKEINTERFACE */) {
          if (argSize === 0) {
            argSize = Type.getArgumentsAndReturnSizes(desc);
            i.intVal = argSize;
          }
          this.code.put12(185 /* INVOKEINTERFACE */, i.index).put11(argSize >> 2, 0);
        } else {
          this.code.put12(opcode, i.index);
        }
      })();
    } else if ((typeof opcode === "number" || opcode === null) && (typeof owner === "string" || owner === null) && (typeof name === "string" || name === null) && (typeof desc === "string" || desc === null) && itf === void 0) {
      return this.visitMethodInsn$int$java_lang_String$java_lang_String$java_lang_String(opcode, owner, name, desc);
    } else {
      throw new Error("invalid overload");
    }
  }
  visitInvokeDynamicInsn(name, desc, bsm, ...bsmArgs) {
    this.lastCodeOffset = this.code.length;
    const i = this.cw.newInvokeDynamicItem(name, desc, bsm, ...bsmArgs);
    let argSize = i.intVal;
    if (this.currentBlock != null) {
      if (this.compute === _MethodWriter.FRAMES || this.compute === _MethodWriter.INSERTED_FRAMES) {
        assert(this.currentBlock.frame);
        this.currentBlock.frame.execute(186 /* INVOKEDYNAMIC */, 0, this.cw, i);
      } else {
        if (argSize === 0) {
          argSize = Type.getArgumentsAndReturnSizes(desc);
          i.intVal = argSize;
        }
        const size = this.stackSize - (argSize >> 2) + (argSize & 3) + 1;
        if (size > this.maxStackSize) {
          this.maxStackSize = size;
        }
        this.stackSize = size;
      }
    }
    this.code.put12(186 /* INVOKEDYNAMIC */, i.index);
    this.code.putShort(0);
  }
  visitJumpInsn(opcode, label) {
    const isWide = opcode >= 200;
    opcode = isWide ? opcode - 33 : opcode;
    this.lastCodeOffset = this.code.length;
    let nextInsn = null;
    if (this.currentBlock != null) {
      if (this.compute === _MethodWriter.FRAMES) {
        assert(this.currentBlock.frame);
        this.currentBlock.frame.execute(opcode, 0, null, null);
        label.getFirst().status |= Label.TARGET;
        this.addSuccessor(Edge.NORMAL, label);
        if (opcode !== 167 /* GOTO */) {
          nextInsn = new Label();
        }
      } else if (this.compute === _MethodWriter.INSERTED_FRAMES) {
        this.currentBlock.frame.execute(opcode, 0, null, null);
      } else {
        if (opcode === 168 /* JSR */) {
          if ((label.status & Label.SUBROUTINE) === 0) {
            label.status |= Label.SUBROUTINE;
            ++this.subroutines;
          }
          this.currentBlock.status |= Label.JSR;
          this.addSuccessor(this.stackSize + 1, label);
          nextInsn = new Label();
        } else {
          this.stackSize += Frame.SIZE_$LI$()[opcode];
          this.addSuccessor(this.stackSize, label);
        }
      }
    }
    if ((label.status & Label.RESOLVED) !== 0 && label.position - this.code.length < SHORT_MIN) {
      if (opcode === 167 /* GOTO */) {
        this.code.putByte(200);
      } else if (opcode === 168 /* JSR */) {
        this.code.putByte(201);
      } else {
        if (nextInsn != null) {
          nextInsn.status |= Label.TARGET;
        }
        this.code.putByte(opcode <= 166 ? (opcode + 1 ^ 1) - 1 : opcode ^ 1);
        this.code.putShort(8);
        this.code.putByte(200);
      }
      label.put(this, this.code, this.code.length - 1, true);
    } else if (isWide) {
      this.code.putByte(opcode + 33);
      label.put(this, this.code, this.code.length - 1, true);
    } else {
      this.code.putByte(opcode);
      label.put(this, this.code, this.code.length - 1, false);
    }
    if (this.currentBlock != null) {
      if (nextInsn != null) {
        this.visitLabel(nextInsn);
      }
      if (opcode === 167 /* GOTO */) {
        this.noSuccessor();
      }
    }
  }
  visitLabel(label) {
    this.cw.hasAsmInsns = this.cw.hasAsmInsns || label.resolve(this, this.code.length, this.code.data);
    if ((label.status & Label.DEBUG) !== 0) {
      return;
    }
    if (this.compute === _MethodWriter.FRAMES) {
      if (this.currentBlock != null) {
        if (label.position === this.currentBlock.position) {
          this.currentBlock.status |= label.status & Label.TARGET;
          label.frame = this.currentBlock.frame;
          return;
        }
        this.addSuccessor(Edge.NORMAL, label);
      }
      this.currentBlock = label;
      if (label.frame == null) {
        label.frame = new Frame(label);
      }
      if (this.previousBlock != null) {
        if (label.position === this.previousBlock.position) {
          this.previousBlock.status |= label.status & Label.TARGET;
          label.frame = this.previousBlock.frame;
          this.currentBlock = this.previousBlock;
          return;
        }
        this.previousBlock.successor = label;
      }
      this.previousBlock = label;
    } else if (this.compute === _MethodWriter.INSERTED_FRAMES) {
      if (this.currentBlock == null) {
        this.currentBlock = label;
      } else {
        assert(this.currentBlock.frame);
        this.currentBlock.frame.owner = label;
      }
    } else if (this.compute === _MethodWriter.MAXS) {
      if (this.currentBlock != null) {
        this.currentBlock.outputStackMax = this.maxStackSize;
        this.addSuccessor(this.stackSize, label);
      }
      this.currentBlock = label;
      this.stackSize = 0;
      this.maxStackSize = 0;
      if (this.previousBlock != null) {
        this.previousBlock.successor = label;
      }
      this.previousBlock = label;
    }
  }
  visitLdcInsn(cst) {
    this.lastCodeOffset = this.code.length;
    const i = this.cw.newConstItem(cst);
    if (this.currentBlock != null) {
      if (this.compute === _MethodWriter.FRAMES || this.compute === _MethodWriter.INSERTED_FRAMES) {
        this.currentBlock.frame.execute(18 /* LDC */, 0, this.cw, i);
      } else {
        let size;
        if (i.type === ClassWriter.LONG || i.type === ClassWriter.DOUBLE) {
          size = this.stackSize + 2;
        } else {
          size = this.stackSize + 1;
        }
        if (size > this.maxStackSize) {
          this.maxStackSize = size;
        }
        this.stackSize = size;
      }
    }
    const index = i.index;
    if (i.type === ClassWriter.LONG || i.type === ClassWriter.DOUBLE) {
      this.code.put12(20, index);
    } else if (index >= 256) {
      this.code.put12(19, index);
    } else {
      this.code.put11(18 /* LDC */, index);
    }
  }
  visitIincInsn(__var, increment) {
    this.lastCodeOffset = this.code.length;
    if (this.currentBlock != null) {
      if (this.compute === _MethodWriter.FRAMES || this.compute === _MethodWriter.INSERTED_FRAMES) {
        this.currentBlock.frame.execute(132 /* IINC */, __var, null, null);
      }
    }
    if (this.compute !== _MethodWriter.NOTHING) {
      const n = __var + 1;
      if (n > this.maxLocals) {
        this.maxLocals = n;
      }
    }
    if (__var > 255 || increment > 127 || increment < -128) {
      this.code.putByte(196).put12(132 /* IINC */, __var).putShort(increment);
    } else {
      this.code.putByte(132 /* IINC */).put11(__var, increment);
    }
  }
  visitTableSwitchInsn(min, max, dflt, ...labels) {
    this.lastCodeOffset = this.code.length;
    const source = this.code.length;
    this.code.putByte(170 /* TABLESWITCH */);
    this.code.putByteArray(null, 0, (4 - this.code.length % 4) % 4);
    dflt.put(this, this.code, source, true);
    this.code.putInt(min).putInt(max);
    for (let i = 0; i < labels.length; ++i) {
      labels[i].put(this, this.code, source, true);
    }
    this.visitSwitchInsn(dflt, labels);
  }
  visitLookupSwitchInsn(dflt, keys, labels) {
    this.lastCodeOffset = this.code.length;
    const source = this.code.length;
    this.code.putByte(171 /* LOOKUPSWITCH */);
    this.code.putByteArray(null, 0, (4 - this.code.length % 4) % 4);
    dflt.put(this, this.code, source, true);
    this.code.putInt(labels.length);
    for (let i = 0; i < labels.length; ++i) {
      this.code.putInt(keys[i]);
      labels[i].put(this, this.code, source, true);
    }
    this.visitSwitchInsn(dflt, labels);
  }
  visitSwitchInsn(dflt, labels) {
    if (this.currentBlock != null) {
      if (this.compute === _MethodWriter.FRAMES) {
        assert(this.currentBlock.frame);
        this.currentBlock.frame.execute(171 /* LOOKUPSWITCH */, 0, null, null);
        this.addSuccessor(Edge.NORMAL, dflt);
        dflt.getFirst().status |= Label.TARGET;
        for (let i = 0; i < labels.length; ++i) {
          this.addSuccessor(Edge.NORMAL, labels[i]);
          labels[i].getFirst().status |= Label.TARGET;
        }
      } else {
        --this.stackSize;
        this.addSuccessor(this.stackSize, dflt);
        for (let i = 0; i < labels.length; ++i) {
          this.addSuccessor(this.stackSize, labels[i]);
        }
      }
      this.noSuccessor();
    }
  }
  visitMultiANewArrayInsn(desc, dims) {
    this.lastCodeOffset = this.code.length;
    const i = this.cw.newClassItem(desc);
    if (this.currentBlock != null) {
      if (this.compute === _MethodWriter.FRAMES || this.compute === _MethodWriter.INSERTED_FRAMES) {
        assert(this.currentBlock.frame);
        this.currentBlock.frame.execute(197 /* MULTIANEWARRAY */, dims, this.cw, i);
      } else {
        this.stackSize += 1 - dims;
      }
    }
    this.code.put12(197 /* MULTIANEWARRAY */, i.index).putByte(dims);
  }
  visitInsnAnnotation(typeRef, typePath, desc, visible) {
    if (!ClassReader.ANNOTATIONS) {
      return null;
    }
    const bv = new ByteVector();
    typeRef = typeRef & -16776961 | this.lastCodeOffset << 8;
    AnnotationWriter.putTarget(typeRef, typePath, bv);
    bv.putShort(this.cw.newUTF8(desc)).putShort(0);
    const aw = new AnnotationWriter(this.cw, true, bv, bv, bv.length - 2);
    if (visible) {
      aw.next = this.ctanns;
      this.ctanns = aw;
    } else {
      aw.next = this.ictanns;
      this.ictanns = aw;
    }
    return aw;
  }
  visitTryCatchBlock(start, end, handler, type) {
    ++this.handlerCount;
    const h = new Handler();
    h.start = start;
    h.end = end;
    h.handler = handler;
    h.desc = type;
    h.type = type != null ? this.cw.newClass(type) : 0;
    if (this.lastHandler == null) {
      this.firstHandler = h;
    } else {
      this.lastHandler.next = h;
    }
    this.lastHandler = h;
  }
  visitTryCatchAnnotation(typeRef, typePath, desc, visible) {
    if (!ClassReader.ANNOTATIONS) {
      return null;
    }
    const bv = new ByteVector();
    AnnotationWriter.putTarget(typeRef, typePath, bv);
    bv.putShort(this.cw.newUTF8(desc)).putShort(0);
    const aw = new AnnotationWriter(this.cw, true, bv, bv, bv.length - 2);
    if (visible) {
      aw.next = this.ctanns;
      this.ctanns = aw;
    } else {
      aw.next = this.ictanns;
      this.ictanns = aw;
    }
    return aw;
  }
  visitLocalVariable(name, desc, signature, start, end, index) {
    if (signature != null) {
      if (this.localVarType == null) {
        this.localVarType = new ByteVector();
      }
      ++this.localVarTypeCount;
      this.localVarType.putShort(start.position).putShort(end.position - start.position).putShort(this.cw.newUTF8(name)).putShort(this.cw.newUTF8(signature)).putShort(index);
    }
    if (this.localVar == null) {
      this.localVar = new ByteVector();
    }
    ++this.localVarCount;
    this.localVar.putShort(start.position).putShort(end.position - start.position).putShort(this.cw.newUTF8(name)).putShort(this.cw.newUTF8(desc)).putShort(index);
    if (this.compute !== _MethodWriter.NOTHING) {
      const c = desc.charAt(0);
      const n = index + (c === "J" || c === "D" ? 2 : 1);
      if (n > this.maxLocals) {
        this.maxLocals = n;
      }
    }
  }
  visitLocalVariableAnnotation(typeRef, typePath, start, end, index, desc, visible) {
    if (!ClassReader.ANNOTATIONS) {
      return null;
    }
    const bv = new ByteVector();
    bv.putByte(typeRef >>> 24).putShort(start.length);
    for (let i = 0; i < start.length; ++i) {
      bv.putShort(start[i].position).putShort(end[i].position - start[i].position).putShort(index[i]);
    }
    if (typePath == null) {
      bv.putByte(0);
    } else {
      const length = typePath.buf[typePath.offset] * 2 + 1;
      bv.putByteArray(typePath.buf, typePath.offset, length);
    }
    bv.putShort(this.cw.newUTF8(desc)).putShort(0);
    const aw = new AnnotationWriter(this.cw, true, bv, bv, bv.length - 2);
    if (visible) {
      aw.next = this.ctanns;
      this.ctanns = aw;
    } else {
      aw.next = this.ictanns;
      this.ictanns = aw;
    }
    return aw;
  }
  visitLineNumber(line, start) {
    if (this.lineNumber == null) {
      this.lineNumber = new ByteVector();
    }
    ++this.lineNumberCount;
    this.lineNumber.putShort(start.position);
    this.lineNumber.putShort(line);
  }
  visitMaxs(maxStack, maxLocals) {
    if (ClassReader.FRAMES && this.compute === _MethodWriter.FRAMES) {
      let handler = this.firstHandler;
      while (handler != null) {
        assert(handler.start);
        assert(handler.handler);
        assert(handler.end);
        let l2 = handler.start.getFirst();
        const h = handler.handler.getFirst();
        const e = handler.end.getFirst();
        const t = handler.desc == null ? "java/lang/Throwable" : handler.desc;
        const kind = Frame.OBJECT_$LI$() | this.cw.addType(t);
        h.status |= Label.TARGET;
        while (l2 !== e) {
          const b = new Edge();
          b.info = kind;
          b.successor = h;
          b.next = l2.successors;
          l2.successors = b;
          l2 = l2.successor;
        }
        handler = handler.next;
      }
      assert(this.labels);
      assert(this.labels.frame);
      let f = this.labels.frame;
      f.initInputFrame(this.cw, this.access, Type.getArgumentTypes(this.descriptor), this.maxLocals);
      this.visitFrame(f);
      let max = 0;
      let changed = this.labels;
      while (changed != null) {
        const l2 = changed;
        changed = changed.next;
        l2.next = null;
        f = l2.frame;
        if ((l2.status & Label.TARGET) !== 0) {
          l2.status |= Label.STORE;
        }
        assert(f);
        l2.status |= Label.REACHABLE;
        const blockMax = f.inputStack.length + l2.outputStackMax;
        if (blockMax > max) {
          max = blockMax;
        }
        let e = l2.successors;
        while (e != null) {
          const n = e.successor.getFirst();
          const change = f.merge(this.cw, n.frame, e.info);
          if (change && n.next == null) {
            n.next = changed;
            changed = n;
          }
          e = e.next;
        }
      }
      let l = this.labels;
      while (l != null) {
        f = l.frame;
        if ((l.status & Label.STORE) !== 0) {
          this.visitFrame(f);
        }
        if ((l.status & Label.REACHABLE) === 0) {
          const k = l.successor;
          const start = l.position;
          const end = (k == null ? this.code.length : k.position) - 1;
          if (end >= start) {
            max = Math.max(max, 1);
            for (let i = start; i < end; ++i) {
              this.code.data[i] = 0 /* NOP */;
            }
            this.code.data[end] = 191 /* ATHROW */ | 0;
            const frameIndex = this.startFrame(start, 0, 1);
            assert(this.frame);
            this.frame[frameIndex] = Frame.OBJECT_$LI$() | this.cw.addType("java/lang/Throwable");
            this.endFrame();
            this.firstHandler = Handler.remove(this.firstHandler, l, k);
          }
        }
        l = l.successor;
      }
      handler = this.firstHandler;
      this.handlerCount = 0;
      while (handler != null) {
        this.handlerCount += 1;
        handler = handler.next;
      }
      this.maxStack = max;
    } else if (this.compute === _MethodWriter.MAXS) {
      let handler = this.firstHandler;
      while (handler != null) {
        let l = handler.start;
        const h = handler.handler;
        const e = handler.end;
        while (l !== e) {
          const b = new Edge();
          b.info = Edge.EXCEPTION;
          b.successor = h;
          if ((l.status & Label.JSR) === 0) {
            b.next = l.successors;
            l.successors = b;
          } else {
            b.next = l.successors.next.next;
            l.successors.next.next = b;
          }
          l = l.successor;
        }
        handler = handler.next;
      }
      if (this.subroutines > 0) {
        let id = 0;
        assert(this.labels);
        this.labels.visitSubroutine(null, 1, this.subroutines);
        let l = this.labels;
        while (l != null) {
          if ((l.status & Label.JSR) !== 0) {
            const subroutine = l.successors.next.successor;
            assert(subroutine);
            if ((subroutine.status & Label.VISITED) === 0) {
              id += 1;
              subroutine.visitSubroutine(null, Math.round(id / 32) << 32 | 1 << id % 32, this.subroutines);
            }
          }
          l = l.successor;
        }
        l = this.labels;
        while (l != null) {
          if ((l.status & Label.JSR) !== 0) {
            let L = this.labels;
            while (L != null) {
              L.status &= ~Label.VISITED2;
              L = L.successor;
            }
            const subroutine = l.successors.next.successor;
            subroutine.visitSubroutine(l, 0, this.subroutines);
          }
          l = l.successor;
        }
      }
      let max = 0;
      let stack = this.labels;
      while (stack != null) {
        let l = stack;
        stack = stack.next;
        const start = l.inputStackTop;
        const blockMax = start + l.outputStackMax;
        if (blockMax > max) {
          max = blockMax;
        }
        let b = l.successors;
        if ((l.status & Label.JSR) !== 0) {
          b = b.next;
        }
        while (b != null) {
          l = b.successor;
          if (l && (l.status & Label.PUSHED) === 0) {
            l.inputStackTop = b.info === Edge.EXCEPTION ? 1 : start + b.info;
            l.status |= Label.PUSHED;
            l.next = stack;
            stack = l;
          }
          b = b.next;
        }
      }
      this.maxStack = Math.max(maxStack, max);
    } else {
      this.maxStack = maxStack;
      this.maxLocals = maxLocals;
    }
  }
  visitEnd() {
  }
  /**
     * Adds a successor to the {@link #currentBlock currentBlock} block.
     *
     * @param info
     * information about the control flow edge to be added.
     * @param successor
     * the successor block to be added to the current block.
     */
  addSuccessor(info, successor) {
    const b = new Edge();
    b.info = info;
    b.successor = successor;
    assert(this.currentBlock);
    b.next = this.currentBlock.successors;
    this.currentBlock.successors = b;
  }
  /**
     * Ends the current basic block. This method must be used in the case where
     * the current basic block does not have any successor.
     */
  noSuccessor() {
    if (this.compute === _MethodWriter.FRAMES) {
      const l = new Label();
      l.frame = new Frame(l);
      l.resolve(this, this.code.length, this.code.data);
      this.previousBlock.successor = l;
      this.previousBlock = l;
    } else {
      assert(this.currentBlock);
      this.currentBlock.outputStackMax = this.maxStackSize;
    }
    if (this.compute !== _MethodWriter.INSERTED_FRAMES) {
      this.currentBlock = null;
    }
  }
  /**
     * Visits a frame that has been computed from scratch.
     *
     * @param f
     * the frame that must be visited.
     */
  visitFrame$Frame(f) {
    let i;
    let t;
    let nTop = 0;
    let nLocal = 0;
    let nStack = 0;
    const locals = f.inputLocals;
    const stacks = f.inputStack;
    for (i = 0; i < locals.length; ++i) {
      t = locals[i];
      if (t === Frame.TOP_$LI$()) {
        ++nTop;
      } else {
        nLocal += nTop + 1;
        nTop = 0;
      }
      if (t === Frame.LONG_$LI$() || t === Frame.DOUBLE_$LI$()) {
        ++i;
      }
    }
    for (i = 0; i < stacks.length; ++i) {
      t = stacks[i];
      ++nStack;
      if (t === Frame.LONG_$LI$() || t === Frame.DOUBLE_$LI$()) {
        ++i;
      }
    }
    let frameIndex = this.startFrame(f.owner.position, nLocal, nStack);
    assert(this.frame);
    for (i = 0; nLocal > 0; ++i, --nLocal) {
      t = locals[i];
      this.frame[frameIndex++] = t;
      if (t === Frame.LONG_$LI$() || t === Frame.DOUBLE_$LI$()) {
        ++i;
      }
    }
    for (i = 0; i < stacks.length; ++i) {
      t = stacks[i];
      this.frame[frameIndex++] = t;
      if (t === Frame.LONG_$LI$() || t === Frame.DOUBLE_$LI$()) {
        ++i;
      }
    }
    this.endFrame();
  }
  /**
     * Visit the implicit first frame of this method.
     */
  visitImplicitFirstFrame() {
    assert(this.frame);
    let frameIndex = this.startFrame(0, this.descriptor.length + 1, 0);
    if ((this.access & 8 /* ACC_STATIC */) === 0) {
      if ((this.access & _MethodWriter.ACC_CONSTRUCTOR) === 0) {
        this.frame[frameIndex++] = Frame.OBJECT_$LI$() | this.cw.addType(this.cw.thisName);
      } else {
        this.frame[frameIndex++] = 6;
      }
    }
    let i = 1;
    loop:
      while (true) {
        const j = i;
        switch (this.descriptor.charAt(i++)) {
          case "Z":
          case "C":
          case "B":
          case "S":
          case "I":
            this.frame[frameIndex++] = 1;
            break;
          case "F":
            this.frame[frameIndex++] = 2;
            break;
          case "J":
            this.frame[frameIndex++] = 4;
            break;
          case "D":
            this.frame[frameIndex++] = 3;
            break;
          case "[":
            while (this.descriptor.charAt(i) === "[") {
              ++i;
            }
            if (this.descriptor.charAt(i) === "L") {
              ++i;
              while (this.descriptor.charAt(i) !== ";") {
                ++i;
              }
            }
            this.frame[frameIndex++] = Frame.OBJECT_$LI$() | this.cw.addType(this.descriptor.substring(j, ++i));
            break;
          case "L":
            while (this.descriptor.charAt(i) !== ";") {
              ++i;
            }
            this.frame[frameIndex++] = Frame.OBJECT_$LI$() | this.cw.addType(this.descriptor.substring(j + 1, i++));
            break;
          default:
            break loop;
        }
      }
    this.frame[1] = frameIndex - 3;
    this.endFrame();
  }
  /**
     * Starts the visit of a stack map frame.
     *
     * @param offset
     * the offset of the instruction to which the frame corresponds.
     * @param nLocal
     * the number of local variables in the frame.
     * @param nStack
     * the number of stack elements in the frame.
     * @return the index of the next element to be written in this frame.
     */
  startFrame(offset, nLocal, nStack) {
    const n = 3 + nLocal + nStack;
    if (this.frame == null || this.frame.length < n) {
      this.frame = new Array(n);
    }
    this.frame[0] = offset;
    this.frame[1] = nLocal;
    this.frame[2] = nStack;
    return 3;
  }
  /**
     * Checks if the visit of the current frame {@link #frame} is finished, and
     * if yes, write it in the StackMapTable attribute.
     */
  endFrame() {
    if (this.previousFrame != null) {
      if (this.stackMap == null) {
        this.stackMap = new ByteVector();
      }
      this.writeFrame();
      ++this.frameCount;
    }
    this.previousFrame = this.frame;
    this.frame = null;
  }
  /**
     * Compress and writes the current frame {@link #frame} in the StackMapTable
     * attribute.
     */
  writeFrame() {
    assert(this.frame);
    assert(this.previousFrame);
    assert(this.stackMap);
    const clocalsSize = this.frame[1];
    const cstackSize = this.frame[2];
    if ((this.cw.version & 65535) < 50 /* V1_6 */) {
      this.stackMap.putShort(this.frame[0]).putShort(clocalsSize);
      this.writeFrameTypes(3, 3 + clocalsSize);
      this.stackMap.putShort(cstackSize);
      this.writeFrameTypes(3 + clocalsSize, 3 + clocalsSize + cstackSize);
      return;
    }
    let localsSize = this.previousFrame[1];
    let type = _MethodWriter.FULL_FRAME;
    let k = 0;
    let delta;
    if (this.frameCount === 0) {
      delta = this.frame[0];
    } else {
      delta = this.frame[0] - this.previousFrame[0] - 1;
    }
    if (cstackSize === 0) {
      k = clocalsSize - localsSize;
      switch (k) {
        case -3:
        case -2:
        case -1:
          type = _MethodWriter.CHOP_FRAME;
          localsSize = clocalsSize;
          break;
        case 0:
          type = delta < 64 ? _MethodWriter.SAME_FRAME : _MethodWriter.SAME_FRAME_EXTENDED;
          break;
        case 1:
        case 2:
        case 3:
          type = _MethodWriter.APPEND_FRAME;
          break;
      }
    } else if (clocalsSize === localsSize && cstackSize === 1) {
      type = delta < 63 ? _MethodWriter.SAME_LOCALS_1_STACK_ITEM_FRAME : _MethodWriter.SAME_LOCALS_1_STACK_ITEM_FRAME_EXTENDED;
    }
    if (type !== _MethodWriter.FULL_FRAME) {
      let l = 3;
      for (let j = 0; j < localsSize; j++) {
        if (this.frame[l] !== this.previousFrame[l]) {
          type = _MethodWriter.FULL_FRAME;
          break;
        }
        l++;
      }
    }
    switch (type) {
      case _MethodWriter.SAME_FRAME:
        this.stackMap.putByte(delta);
        break;
      case _MethodWriter.SAME_LOCALS_1_STACK_ITEM_FRAME:
        this.stackMap.putByte(_MethodWriter.SAME_LOCALS_1_STACK_ITEM_FRAME + delta);
        this.writeFrameTypes(3 + clocalsSize, 4 + clocalsSize);
        break;
      case _MethodWriter.SAME_LOCALS_1_STACK_ITEM_FRAME_EXTENDED:
        this.stackMap.putByte(_MethodWriter.SAME_LOCALS_1_STACK_ITEM_FRAME_EXTENDED).putShort(delta);
        this.writeFrameTypes(3 + clocalsSize, 4 + clocalsSize);
        break;
      case _MethodWriter.SAME_FRAME_EXTENDED:
        this.stackMap.putByte(_MethodWriter.SAME_FRAME_EXTENDED).putShort(delta);
        break;
      case _MethodWriter.CHOP_FRAME:
        this.stackMap.putByte(_MethodWriter.SAME_FRAME_EXTENDED + k).putShort(delta);
        break;
      case _MethodWriter.APPEND_FRAME:
        this.stackMap.putByte(_MethodWriter.SAME_FRAME_EXTENDED + k).putShort(delta);
        this.writeFrameTypes(3 + localsSize, 3 + clocalsSize);
        break;
      default:
        this.stackMap.putByte(_MethodWriter.FULL_FRAME).putShort(delta).putShort(clocalsSize);
        this.writeFrameTypes(3, 3 + clocalsSize);
        this.stackMap.putShort(cstackSize);
        this.writeFrameTypes(3 + clocalsSize, 3 + clocalsSize + cstackSize);
    }
  }
  /**
     * Writes some types of the current frame {@link #frame} into the
     * StackMapTableAttribute. This method converts types from the format used
     * in {@link Label} to the format used in StackMapTable attributes. In
     * particular, it converts type table indexes to constant pool indexes.
     *
     * @param start
     * index of the first type in {@link #frame} to write.
     * @param end
     * index of last type in {@link #frame} to write (exclusive).
     */
  writeFrameTypes(start, end) {
    assert(this.frame);
    assert(this.stackMap);
    for (let i = start; i < end; ++i) {
      const t = this.frame[i];
      let d = t & Frame.DIM;
      if (d === 0) {
        const v = t & Frame.BASE_VALUE;
        switch (t & Frame.BASE_KIND) {
          case Frame.OBJECT_$LI$():
            this.stackMap.putByte(7).putShort(this.cw.newClass(this.cw.typeTable[v].strVal1));
            break;
          case Frame.UNINITIALIZED_$LI$():
            this.stackMap.putByte(8).putShort(this.cw.typeTable[v].intVal);
            break;
          default:
            this.stackMap.putByte(v);
        }
      } else {
        let sb = "";
        d >>= 28;
        while (d-- > 0) {
          sb += "[";
        }
        if ((t & Frame.BASE_KIND) === Frame.OBJECT_$LI$()) {
          sb += "L";
          sb += this.cw.typeTable[t & Frame.BASE_VALUE].strVal1;
          sb += ";";
        } else {
          switch (t & 15) {
            case 1:
              sb += "I";
              break;
            case 2:
              sb += "F";
              break;
            case 3:
              sb += "D";
              break;
            case 9:
              sb += "Z";
              break;
            case 10:
              sb += "B";
              break;
            case 11:
              sb += "C";
              break;
            case 12:
              sb += "S";
              break;
            default:
              sb += "J";
          }
        }
        this.stackMap.putByte(7).putShort(this.cw.newClass(sb.toString()));
      }
    }
  }
  writeFrameType(type) {
    assert(this.stackMap);
    if (typeof type === "string") {
      this.stackMap.putByte(7).putShort(this.cw.newClass(type));
    } else if (typeof type === "number") {
      this.stackMap.putByte(
        /* intValue */
        type | 0
      );
    } else {
      this.stackMap.putByte(8).putShort(type.position);
    }
  }
  /**
     * Returns the size of the bytecode of this method.
     *
     * @return the size of the bytecode of this method.
     */
  getSize() {
    if (this.classReaderOffset !== 0) {
      return 6 + this.classReaderLength;
    }
    let size = 8;
    if (this.code.length > 0) {
      if (this.code.length > 65535) {
        throw new Error("Method code too large!");
      }
      this.cw.newUTF8("Code");
      size += 18 + this.code.length + 8 * this.handlerCount;
      if (this.localVar != null) {
        this.cw.newUTF8("LocalVariableTable");
        size += 8 + this.localVar.length;
      }
      if (this.localVarType != null) {
        this.cw.newUTF8("LocalVariableTypeTable");
        size += 8 + this.localVarType.length;
      }
      if (this.lineNumber != null) {
        this.cw.newUTF8("LineNumberTable");
        size += 8 + this.lineNumber.length;
      }
      if (this.stackMap != null) {
        const zip = (this.cw.version & 65535) >= 50 /* V1_6 */;
        this.cw.newUTF8(zip ? "StackMapTable" : "StackMap");
        size += 8 + this.stackMap.length;
      }
      if (ClassReader.ANNOTATIONS && this.ctanns != null) {
        this.cw.newUTF8("RuntimeVisibleTypeAnnotations");
        size += 8 + this.ctanns.getSize();
      }
      if (ClassReader.ANNOTATIONS && this.ictanns != null) {
        this.cw.newUTF8("RuntimeInvisibleTypeAnnotations");
        size += 8 + this.ictanns.getSize();
      }
      if (this.cattrs != null) {
        size += this.cattrs.getSize(this.cw, this.code.data, this.code.length, this.maxStack, this.maxLocals);
      }
    }
    if (this.exceptionCount > 0) {
      this.cw.newUTF8("Exceptions");
      size += 8 + 2 * this.exceptionCount;
    }
    if ((this.access & 4096 /* ACC_SYNTHETIC */) !== 0) {
      if ((this.cw.version & 65535) < 49 /* V1_5 */ || (this.access & ClassWriter.ACC_SYNTHETIC_ATTRIBUTE) !== 0) {
        this.cw.newUTF8("Synthetic");
        size += 6;
      }
    }
    if ((this.access & 131072 /* ACC_DEPRECATED */) !== 0) {
      this.cw.newUTF8("Deprecated");
      size += 6;
    }
    if (ClassReader.SIGNATURES && this.signature != null) {
      this.cw.newUTF8("Signature");
      this.cw.newUTF8(this.signature);
      size += 8;
    }
    if (this.methodParameters != null) {
      this.cw.newUTF8("MethodParameters");
      size += 7 + this.methodParameters.length;
    }
    if (ClassReader.ANNOTATIONS && this.annd != null) {
      this.cw.newUTF8("AnnotationDefault");
      size += 6 + this.annd.length;
    }
    if (ClassReader.ANNOTATIONS && this.anns != null) {
      this.cw.newUTF8("RuntimeVisibleAnnotations");
      size += 8 + this.anns.getSize();
    }
    if (ClassReader.ANNOTATIONS && this.ianns != null) {
      this.cw.newUTF8("RuntimeInvisibleAnnotations");
      size += 8 + this.ianns.getSize();
    }
    if (ClassReader.ANNOTATIONS && this.tanns != null) {
      this.cw.newUTF8("RuntimeVisibleTypeAnnotations");
      size += 8 + this.tanns.getSize();
    }
    if (ClassReader.ANNOTATIONS && this.itanns != null) {
      this.cw.newUTF8("RuntimeInvisibleTypeAnnotations");
      size += 8 + this.itanns.getSize();
    }
    if (ClassReader.ANNOTATIONS && this.panns != null) {
      this.cw.newUTF8("RuntimeVisibleParameterAnnotations");
      size += 7 + 2 * (this.panns.length - this.synthetics);
      for (let i = this.panns.length - 1; i >= this.synthetics; --i) {
        size += this.panns[i] == null ? 0 : this.panns[i].getSize();
      }
    }
    if (ClassReader.ANNOTATIONS && this.ipanns != null) {
      this.cw.newUTF8("RuntimeInvisibleParameterAnnotations");
      size += 7 + 2 * (this.ipanns.length - this.synthetics);
      for (let i = this.ipanns.length - 1; i >= this.synthetics; --i) {
        size += this.ipanns[i] == null ? 0 : this.ipanns[i].getSize();
      }
    }
    if (this.attrs != null) {
      size += this.attrs.getSize(this.cw, null, 0, -1, -1);
    }
    return size;
  }
  /**
     * Puts the bytecode of this method in the given byte vector.
     *
     * @param out
     * the byte vector into which the bytecode of this method must be
     * copied.
     */
  put(out) {
    const FACTOR = ClassWriter.TO_ACC_SYNTHETIC_$LI$();
    const mask = _MethodWriter.ACC_CONSTRUCTOR | 131072 /* ACC_DEPRECATED */ | ClassWriter.ACC_SYNTHETIC_ATTRIBUTE | ((this.access & ClassWriter.ACC_SYNTHETIC_ATTRIBUTE) / FACTOR | 0);
    out.putShort(this.access & ~mask).putShort(this.name).putShort(this.desc);
    if (this.classReaderOffset !== 0) {
      out.putByteArray(this.cw.cr.buf, this.classReaderOffset, this.classReaderLength);
      return;
    }
    let attributeCount = 0;
    if (this.code.length > 0) {
      ++attributeCount;
    }
    if (this.exceptionCount > 0) {
      ++attributeCount;
    }
    if ((this.access & 4096 /* ACC_SYNTHETIC */) !== 0) {
      if ((this.cw.version & 65535) < 49 /* V1_5 */ || (this.access & ClassWriter.ACC_SYNTHETIC_ATTRIBUTE) !== 0) {
        ++attributeCount;
      }
    }
    if ((this.access & 131072 /* ACC_DEPRECATED */) !== 0) {
      ++attributeCount;
    }
    if (ClassReader.SIGNATURES && this.signature != null) {
      ++attributeCount;
    }
    if (this.methodParameters != null) {
      ++attributeCount;
    }
    if (ClassReader.ANNOTATIONS && this.annd != null) {
      ++attributeCount;
    }
    if (ClassReader.ANNOTATIONS && this.anns != null) {
      ++attributeCount;
    }
    if (ClassReader.ANNOTATIONS && this.ianns != null) {
      ++attributeCount;
    }
    if (ClassReader.ANNOTATIONS && this.tanns != null) {
      ++attributeCount;
    }
    if (ClassReader.ANNOTATIONS && this.itanns != null) {
      ++attributeCount;
    }
    if (ClassReader.ANNOTATIONS && this.panns != null) {
      ++attributeCount;
    }
    if (ClassReader.ANNOTATIONS && this.ipanns != null) {
      ++attributeCount;
    }
    if (this.attrs != null) {
      attributeCount += this.attrs.getCount();
    }
    out.putShort(attributeCount);
    if (this.code.length > 0) {
      let size = 12 + this.code.length + 8 * this.handlerCount;
      if (this.localVar != null) {
        size += 8 + this.localVar.length;
      }
      if (this.localVarType != null) {
        size += 8 + this.localVarType.length;
      }
      if (this.lineNumber != null) {
        size += 8 + this.lineNumber.length;
      }
      if (this.stackMap != null) {
        size += 8 + this.stackMap.length;
      }
      if (ClassReader.ANNOTATIONS && this.ctanns != null) {
        size += 8 + this.ctanns.getSize();
      }
      if (ClassReader.ANNOTATIONS && this.ictanns != null) {
        size += 8 + this.ictanns.getSize();
      }
      if (this.cattrs != null) {
        size += this.cattrs.getSize(this.cw, this.code.data, this.code.length, this.maxStack, this.maxLocals);
      }
      out.putShort(this.cw.newUTF8("Code")).putInt(size);
      out.putShort(this.maxStack).putShort(this.maxLocals);
      out.putInt(this.code.length).putByteArray(this.code.data, 0, this.code.length);
      out.putShort(this.handlerCount);
      if (this.handlerCount > 0) {
        let h = this.firstHandler;
        while (h != null) {
          out.putShort(h.start.position).putShort(h.end.position).putShort(h.handler.position).putShort(h.type);
          h = h.next;
        }
      }
      attributeCount = 0;
      if (this.localVar != null) {
        ++attributeCount;
      }
      if (this.localVarType != null) {
        ++attributeCount;
      }
      if (this.lineNumber != null) {
        ++attributeCount;
      }
      if (this.stackMap != null) {
        ++attributeCount;
      }
      if (ClassReader.ANNOTATIONS && this.ctanns != null) {
        ++attributeCount;
      }
      if (ClassReader.ANNOTATIONS && this.ictanns != null) {
        ++attributeCount;
      }
      if (this.cattrs != null) {
        attributeCount += this.cattrs.getCount();
      }
      out.putShort(attributeCount);
      if (this.localVar != null) {
        out.putShort(this.cw.newUTF8("LocalVariableTable"));
        out.putInt(this.localVar.length + 2).putShort(this.localVarCount);
        out.putByteArray(this.localVar.data, 0, this.localVar.length);
      }
      if (this.localVarType != null) {
        out.putShort(this.cw.newUTF8("LocalVariableTypeTable"));
        out.putInt(this.localVarType.length + 2).putShort(this.localVarTypeCount);
        out.putByteArray(this.localVarType.data, 0, this.localVarType.length);
      }
      if (this.lineNumber != null) {
        out.putShort(this.cw.newUTF8("LineNumberTable"));
        out.putInt(this.lineNumber.length + 2).putShort(this.lineNumberCount);
        out.putByteArray(this.lineNumber.data, 0, this.lineNumber.length);
      }
      if (this.stackMap != null) {
        const zip = (this.cw.version & 65535) >= 50 /* V1_6 */;
        out.putShort(this.cw.newUTF8(zip ? "StackMapTable" : "StackMap"));
        out.putInt(this.stackMap.length + 2).putShort(this.frameCount);
        out.putByteArray(this.stackMap.data, 0, this.stackMap.length);
      }
      if (ClassReader.ANNOTATIONS && this.ctanns != null) {
        out.putShort(this.cw.newUTF8("RuntimeVisibleTypeAnnotations"));
        this.ctanns.put(out);
      }
      if (ClassReader.ANNOTATIONS && this.ictanns != null) {
        out.putShort(this.cw.newUTF8("RuntimeInvisibleTypeAnnotations"));
        this.ictanns.put(out);
      }
      if (this.cattrs != null) {
        this.cattrs.put(this.cw, this.code.data, this.code.length, this.maxLocals, this.maxStack, out);
      }
    }
    if (this.exceptionCount > 0) {
      assert(this.exceptions);
      out.putShort(this.cw.newUTF8("Exceptions")).putInt(2 * this.exceptionCount + 2);
      out.putShort(this.exceptionCount);
      for (let i = 0; i < this.exceptionCount; ++i) {
        out.putShort(this.exceptions[i]);
      }
    }
    if ((this.access & 4096 /* ACC_SYNTHETIC */) !== 0) {
      if ((this.cw.version & 65535) < 49 /* V1_5 */ || (this.access & ClassWriter.ACC_SYNTHETIC_ATTRIBUTE) !== 0) {
        out.putShort(this.cw.newUTF8("Synthetic")).putInt(0);
      }
    }
    if ((this.access & 131072 /* ACC_DEPRECATED */) !== 0) {
      out.putShort(this.cw.newUTF8("Deprecated")).putInt(0);
    }
    if (ClassReader.SIGNATURES && this.signature != null) {
      out.putShort(this.cw.newUTF8("Signature")).putInt(2).putShort(this.cw.newUTF8(this.signature));
    }
    if (this.methodParameters != null) {
      out.putShort(this.cw.newUTF8("MethodParameters"));
      out.putInt(this.methodParameters.length + 1).putByte(this.methodParametersCount);
      out.putByteArray(this.methodParameters.data, 0, this.methodParameters.length);
    }
    if (ClassReader.ANNOTATIONS && this.annd != null) {
      out.putShort(this.cw.newUTF8("AnnotationDefault"));
      out.putInt(this.annd.length);
      out.putByteArray(this.annd.data, 0, this.annd.length);
    }
    if (ClassReader.ANNOTATIONS && this.anns != null) {
      out.putShort(this.cw.newUTF8("RuntimeVisibleAnnotations"));
      this.anns.put(out);
    }
    if (ClassReader.ANNOTATIONS && this.ianns != null) {
      out.putShort(this.cw.newUTF8("RuntimeInvisibleAnnotations"));
      this.ianns.put(out);
    }
    if (ClassReader.ANNOTATIONS && this.tanns != null) {
      out.putShort(this.cw.newUTF8("RuntimeVisibleTypeAnnotations"));
      this.tanns.put(out);
    }
    if (ClassReader.ANNOTATIONS && this.itanns != null) {
      out.putShort(this.cw.newUTF8("RuntimeInvisibleTypeAnnotations"));
      this.itanns.put(out);
    }
    if (ClassReader.ANNOTATIONS && this.panns != null) {
      out.putShort(this.cw.newUTF8("RuntimeVisibleParameterAnnotations"));
      AnnotationWriter.put(this.panns, this.synthetics, out);
    }
    if (ClassReader.ANNOTATIONS && this.ipanns != null) {
      out.putShort(this.cw.newUTF8("RuntimeInvisibleParameterAnnotations"));
      AnnotationWriter.put(this.ipanns, this.synthetics, out);
    }
    if (this.attrs != null) {
      this.attrs.put(this.cw, null, 0, -1, -1, out);
    }
  }
};
var MethodWriter = _MethodWriter;
/**
   * Pseudo access flag used to denote constructors.
   */
__publicField(MethodWriter, "ACC_CONSTRUCTOR", 524288);
/**
   * Frame has exactly the same locals as the previous stack map frame and
   * number of stack items is zero.
   */
__publicField(MethodWriter, "SAME_FRAME", 0);
/**
   * Frame has exactly the same locals as the previous stack map frame and
   * number of stack items is 1
   */
__publicField(MethodWriter, "SAME_LOCALS_1_STACK_ITEM_FRAME", 64);
/**
   * Reserved for future use
   */
__publicField(MethodWriter, "RESERVED", 128);
/**
   * Frame has exactly the same locals as the previous stack map frame and
   * number of stack items is 1. Offset is bigger then 63;
   */
__publicField(MethodWriter, "SAME_LOCALS_1_STACK_ITEM_FRAME_EXTENDED", 247);
/**
   * Frame where current locals are the same as the locals in the previous
   * frame, except that the k last locals are absent. The value of k is given
   * by the formula 251-frame_type.
   */
__publicField(MethodWriter, "CHOP_FRAME", 248);
/**
   * Frame has exactly the same locals as the previous stack map frame and
   * number of stack items is zero. Offset is bigger then 63;
   */
__publicField(MethodWriter, "SAME_FRAME_EXTENDED", 251);
/**
   * Frame where current locals are the same as the locals in the previous
   * frame, except that k additional locals are defined. The value of k is
   * given by the formula frame_type-251.
   */
__publicField(MethodWriter, "APPEND_FRAME", 252);
/**
   * Full frame
   */
__publicField(MethodWriter, "FULL_FRAME", 255);
/**
   * Indicates that the stack map frames must be recomputed from scratch. In
   * this case the maximum stack size and number of local variables is also
   * recomputed from scratch.
   *
   * @see #compute
   */
__publicField(MethodWriter, "FRAMES", 0);
/**
   * Indicates that the stack map frames of type F_INSERT must be computed.
   * The other frames are not (re)computed. They should all be of type F_NEW
   * and should be sufficient to compute the content of the F_INSERT frames,
   * together with the bytecode instructions between a F_NEW and a F_INSERT
   * frame - and without any knowledge of the type hierarchy (by definition of
   * F_INSERT).
   *
   * @see #compute
   */
__publicField(MethodWriter, "INSERTED_FRAMES", 1);
/**
   * Indicates that the maximum stack size and number of local variables must
   * be automatically computed.
   *
   * @see #compute
   */
__publicField(MethodWriter, "MAXS", 2);
/**
   * Indicates that nothing must be automatically computed.
   *
   * @see #compute
   */
__publicField(MethodWriter, "NOTHING", 3);
var Handler = class {
  constructor() {
    /**
       * Beginning of the exception handler's scope (inclusive).
       */
    __publicField(this, "start", null);
    /**
       * End of the exception handler's scope (exclusive).
       */
    __publicField(this, "end", null);
    /**
       * Beginning of the exception handler's code.
       */
    __publicField(this, "handler", null);
    /**
       * Internal name of the type of exceptions handled by this handler, or
       * <tt>null</tt> to catch any exceptions.
       */
    __publicField(this, "desc", "");
    /**
       * Constant pool index of the internal name of the type of exceptions
       * handled by this handler, or 0 to catch any exceptions.
       */
    __publicField(this, "type");
    /**
       * Next exception handler block info.
       */
    __publicField(this, "next", null);
    this.type = 0;
  }
  /**
     * Removes the range between start and end from the given exception
     * handlers.
     *
     * @param h
     * an exception handler list.
     * @param start
     * the start of the range to be removed.
     * @param end
     * the end of the range to be removed. Maybe null.
     * @return the exception handler list with the start-end range removed.
     */
  static remove(h, start, end) {
    if (h == null) {
      return null;
    } else {
      h.next = Handler.remove(h.next, start, end);
    }
    assert(h.start);
    assert(h.end);
    const hstart = h.start.position;
    const hend = h.end.position;
    const s = start.position;
    const e = end == null ? Number.MAX_VALUE : end.position;
    if (s < hend && e > hstart) {
      if (s <= hstart) {
        if (e >= hend) {
          h = h.next;
        } else {
          h.start = end;
        }
      } else if (e >= hend) {
        h.end = start;
      } else {
        const g = new Handler();
        g.start = end;
        g.end = h.end;
        g.handler = h.handler;
        g.desc = h.desc;
        g.type = h.type;
        g.next = h.next;
        h.end = start;
        h.next = g;
      }
    }
    return h;
  }
};

// libs/ClassWriter.ts
var _ClassWriter = class extends ClassVisitor {
  /**
     * Constructs a new {@link ClassWriter} object and enables optimizations for
     * "mostly add" bytecode transformations. These optimizations are the
     * following:
     *
     * <ul>
     * <li>The constant pool from the original class is copied as is in the new
     * class, which saves time. New constant pool entries will be added at the
     * end if necessary, but unused constant pool entries <i>won't be
     * removed</i>.</li>
     * <li>Methods that are not transformed are copied as is in the new class,
     * directly from the original class bytecode (i.e. without emitting visit
     * events for all the method instructions), which saves a <i>lot</i> of
     * time. Untransformed methods are detected by the fact that the
     * {@link ClassReader} receives {@link MethodVisitor} objects that come from
     * a {@link ClassWriter} (and not from any other {@link ClassVisitor}
     * instance).</li>
     * </ul>
     *
     * @param classReader
     * the {@link ClassReader} used to read the original class. It
     * will be used to copy the entire constant pool from the
     * original class and also to copy other fragments of original
     * bytecode where applicable.
     * @param flags
     * option flags that can be used to modify the default behavior
     * of this class. <i>These option flags do not affect methods
     * that are copied as is in the new class. This means that
     * neither the maximum stack size nor the stack frames will be
     * computed for these methods</i>. See {@link #COMPUTE_MAXS},
     * {@link #COMPUTE_FRAMES}.
     */
  constructor(classReader, flags) {
    var __super = (...args) => {
      super(...args);
      /**
         * The class reader from which this class writer was constructed, if any.
         */
      __publicField(this, "cr");
      /**
         * Minor and major version numbers of the class to be generated.
         */
      __publicField(this, "version");
      /**
         * Index of the next item to be added in the constant pool.
         */
      __publicField(this, "index");
      /**
         * The constant pool of this class.
         */
      __publicField(this, "pool");
      /**
         * The constant pool's hash table data.
         */
      __publicField(this, "items");
      /**
         * The threshold of the constant pool's hash table.
         */
      __publicField(this, "threshold");
      /**
         * A reusable key used to look for items in the {@link #items} hash table.
         */
      __publicField(this, "key");
      /**
         * A reusable key used to look for items in the {@link #items} hash table.
         */
      __publicField(this, "key2");
      /**
         * A reusable key used to look for items in the {@link #items} hash table.
         */
      __publicField(this, "key3");
      /**
         * A reusable key used to look for items in the {@link #items} hash table.
         */
      __publicField(this, "key4");
      /**
         * A type table used to temporarily store internal names that will not
         * necessarily be stored in the constant pool. This type table is used by
         * the control flow and data flow analysis algorithm used to compute stack
         * map frames from scratch. This array associates to each index <tt>i</tt>
         * the Item whose index is <tt>i</tt>. All Item objects stored in this array
         * are also stored in the {@link #items} hash table. These two arrays allow
         * to retrieve an Item from its index or, conversely, to get the index of an
         * Item from its value. Each Item stores an internal name in its
         * {@link Item#strVal1} field.
         */
      __publicField(this, "typeTable");
      /**
         * Number of elements in the {@link #typeTable} array.
         */
      __publicField(this, "typeCount");
      /**
         * The access flags of this class.
         */
      __publicField(this, "access");
      /**
         * The constant pool item that contains the internal name of this class.
         */
      __publicField(this, "name");
      /**
         * The internal name of this class.
         */
      __publicField(this, "thisName");
      /**
         * The constant pool item that contains the signature of this class.
         */
      __publicField(this, "signature");
      /**
         * The constant pool item that contains the internal name of the super class
         * of this class.
         */
      __publicField(this, "superName");
      /**
         * Number of interfaces implemented or extended by this class or interface.
         */
      __publicField(this, "interfaceCount");
      /**
         * The interfaces implemented or extended by this class or interface. More
         * precisely, this array contains the indexes of the constant pool items
         * that contain the internal names of these interfaces.
         */
      __publicField(this, "interfaces");
      /**
         * The index of the constant pool item that contains the name of the source
         * file from which this class was compiled.
         */
      __publicField(this, "sourceFile");
      /**
         * The SourceDebug attribute of this class.
         */
      __publicField(this, "sourceDebug");
      /**
         * The constant pool item that contains the name of the enclosing class of
         * this class.
         */
      __publicField(this, "enclosingMethodOwner");
      /**
         * The constant pool item that contains the name and descriptor of the
         * enclosing method of this class.
         */
      __publicField(this, "enclosingMethod");
      /**
         * The runtime visible annotations of this class.
         */
      __publicField(this, "anns");
      /**
         * The runtime invisible annotations of this class.
         */
      __publicField(this, "ianns");
      /**
         * The runtime visible type annotations of this class.
         */
      __publicField(this, "tanns");
      /**
         * The runtime invisible type annotations of this class.
         */
      __publicField(this, "itanns");
      /**
         * The non standard attributes of this class.
         */
      __publicField(this, "attrs");
      /**
         * The number of entries in the InnerClasses attribute.
         */
      __publicField(this, "innerClassesCount");
      /**
         * The InnerClasses attribute.
         */
      __publicField(this, "innerClasses");
      /**
         * The number of entries in the BootstrapMethods attribute.
         */
      __publicField(this, "bootstrapMethodsCount");
      /**
         * The BootstrapMethods attribute.
         */
      __publicField(this, "bootstrapMethods");
      /**
         * The fields of this class. These fields are stored in a linked list of
         * {@link FieldWriter} objects, linked to each other by their
         * {@link FieldWriter#fv} field. This field stores the first element of this
         * list.
         */
      __publicField(this, "firstField");
      /**
         * The fields of this class. These fields are stored in a linked list of
         * {@link FieldWriter} objects, linked to each other by their
         * {@link FieldWriter#fv} field. This field stores the last element of this
         * list.
         */
      __publicField(this, "lastField");
      /**
         * The methods of this class. These methods are stored in a linked list of
         * {@link MethodWriter} objects, linked to each other by their
         * {@link MethodWriter#mv} field. This field stores the first element of
         * this list.
         */
      __publicField(this, "firstMethod");
      /**
         * The methods of this class. These methods are stored in a linked list of
         * {@link MethodWriter} objects, linked to each other by their
         * {@link MethodWriter#mv} field. This field stores the last element of this
         * list.
         */
      __publicField(this, "lastMethod");
      /**
         * Indicates what must be automatically computed.
         *
         * @see MethodWriter#compute
         */
      __publicField(this, "compute");
      /**
         * <tt>true</tt> if some methods have wide forward jumps using ASM pseudo
         * instructions, which need to be expanded into sequences of standard
         * bytecode instructions. In this case the class is re-read and re-written
         * with a ClassReader -> ClassWriter chain to perform this transformation.
         */
      __publicField(this, "hasAsmInsns");
    };
    if ((classReader != null && classReader instanceof ClassReader || classReader === null) && (typeof flags === "number" || flags === null)) {
      const __args = Array.prototype.slice.call(arguments);
      {
        throw new Error("not supported");
      }
    } else if ((typeof classReader === "number" || classReader === null) && flags === void 0) {
      const __args = Array.prototype.slice.call(arguments);
      const flags2 = __args[0];
      __super(327680 /* ASM5 */);
      this.version = 0;
      this.index = 0;
      this.threshold = 0;
      this.typeCount = 0;
      this.access = 0;
      this.name = 0;
      this.signature = 0;
      this.superName = 0;
      this.interfaceCount = 0;
      this.sourceFile = 0;
      this.enclosingMethodOwner = 0;
      this.enclosingMethod = 0;
      this.innerClassesCount = 0;
      this.bootstrapMethodsCount = 0;
      this.compute = 0;
      this.hasAsmInsns = false;
      (() => {
        this.index = 1;
        this.pool = new ByteVector();
        this.items = new Array(256);
        this.threshold = 0.75 * this.items.length | 0;
        this.compute = (flags2 & _ClassWriter.COMPUTE_FRAMES) !== 0 ? MethodWriter.FRAMES : (flags2 & _ClassWriter.COMPUTE_MAXS) !== 0 ? MethodWriter.MAXS : MethodWriter.NOTHING;
      })();
    } else {
      throw new Error("invalid overload");
    }
  }
  static __static_initialize() {
    if (!_ClassWriter.__static_initialized) {
      _ClassWriter.__static_initialized = true;
      _ClassWriter.__static_initializer_0();
    }
  }
  static TO_ACC_SYNTHETIC_$LI$() {
    _ClassWriter.__static_initialize();
    if (_ClassWriter.TO_ACC_SYNTHETIC == null) {
      _ClassWriter.TO_ACC_SYNTHETIC = _ClassWriter.ACC_SYNTHETIC_ATTRIBUTE / 4096 /* ACC_SYNTHETIC */ | 0;
    }
    return _ClassWriter.TO_ACC_SYNTHETIC;
  }
  static TYPE_$LI$() {
    _ClassWriter.__static_initialize();
    return _ClassWriter.TYPE;
  }
  static __static_initializer_0() {
    let i;
    const b = new Array(220);
    const s = "AAAAAAAAAAAAAAAABCLMMDDDDDEEEEEEEEEEEEEEEEEEEEAAAAAAAADDDDDEEEEEEEEEEEEEEEEEEEEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANAAAAAAAAAAAAAAAAAAAAJJJJJJJJJJJJJJJJDOPAAAAAAGGGGGGGHIFBFAAFFAARQJJKKSSSSSSSSSSSSSSSSSS";
    for (i = 0; i < b.length; ++i) {
      b[i] = s.charAt(i).charCodeAt(0) - "A".charCodeAt(0) | 0;
    }
    _ClassWriter.TYPE = b;
  }
  visit(version, access, name, signature, superName, interfaces) {
    this.version = version;
    this.access = access;
    this.name = this.newClass(name);
    this.thisName = name;
    if (ClassReader.SIGNATURES && signature != null) {
      this.signature = this.newUTF8(signature);
    }
    this.superName = superName == null ? 0 : this.newClass(superName);
    if (interfaces != null && interfaces.length > 0) {
      this.interfaceCount = interfaces.length;
      this.interfaces = new Array(this.interfaceCount);
      for (let i = 0; i < this.interfaceCount; ++i) {
        this.interfaces[i] = this.newClass(interfaces[i]);
      }
    }
  }
  visitSource(file, debug) {
    throw new Error("not supported");
  }
  visitOuterClass(owner, name, desc) {
    this.enclosingMethodOwner = this.newClass(owner);
    if (name != null && desc != null) {
      this.enclosingMethod = this.newNameType(name, desc);
    }
  }
  visitAnnotation(desc, visible) {
    if (!ClassReader.ANNOTATIONS) {
      return null;
    }
    const bv = new ByteVector();
    bv.putShort(this.newUTF8(desc)).putShort(0);
    const aw = new AnnotationWriter(this, true, bv, bv, 2);
    if (visible) {
      aw.next = this.anns;
      this.anns = aw;
    } else {
      aw.next = this.ianns;
      this.ianns = aw;
    }
    return aw;
  }
  visitTypeAnnotation(typeRef, typePath, desc, visible) {
    if (!ClassReader.ANNOTATIONS) {
      return null;
    }
    const bv = new ByteVector();
    AnnotationWriter.putTarget(typeRef, typePath, bv);
    bv.putShort(this.newUTF8(desc)).putShort(0);
    const aw = new AnnotationWriter(this, true, bv, bv, bv.length - 2);
    if (visible) {
      aw.next = this.tanns;
      this.tanns = aw;
    } else {
      aw.next = this.itanns;
      this.itanns = aw;
    }
    return aw;
  }
  visitAttribute(attr) {
    attr.next = this.attrs;
    this.attrs = attr;
  }
  visitInnerClass(name, outerName, innerName, access) {
    if (this.innerClasses == null) {
      this.innerClasses = new ByteVector();
    }
    const nameItem = this.newClassItem(name);
    if (nameItem.intVal === 0) {
      ++this.innerClassesCount;
      this.innerClasses.putShort(nameItem.index);
      this.innerClasses.putShort(outerName == null ? 0 : this.newClass(outerName));
      this.innerClasses.putShort(innerName == null ? 0 : this.newUTF8(innerName));
      this.innerClasses.putShort(access);
      nameItem.intVal = this.innerClassesCount;
    } else {
    }
  }
  visitField(access, name, desc, signature, value) {
    return new FieldWriter(this, access, name, desc, signature, value);
  }
  visitMethod(access, name, desc, signature, exceptions) {
    return new MethodWriter(this, access, name, desc, signature, exceptions, this.compute);
  }
  visitEnd() {
  }
  /**
     * Returns the bytecode of the class that was build with this class writer.
     *
     * @return the bytecode of the class that was build with this class writer.
     */
  toByteArray() {
    throw new Error("not supported");
  }
  /**
     * Adds a number or string constant to the constant pool of the class being
     * build. Does nothing if the constant pool already contains a similar item.
     *
     * @param cst
     * the value of the constant to be added to the constant pool.
     * This parameter must be an {@link Integer}, a {@link Float}, a
     * {@link Long}, a {@link Double}, a {@link String} or a
     * {@link Type}.
     * @return a new or already existing constant item with the given value.
     */
  newConstItem(cst) {
    throw new Error("unsupported");
  }
  /**
     * Adds a number or string constant to the constant pool of the class being
     * build. Does nothing if the constant pool already contains a similar item.
     * <i>This method is intended for {@link Attribute} sub classes, and is
     * normally not needed by class generators or adapters.</i>
     *
     * @param cst
     * the value of the constant to be added to the constant pool.
     * This parameter must be an {@link Integer}, a {@link Float}, a
     * {@link Long}, a {@link Double} or a {@link String}.
     * @return the index of a new or already existing constant item with the
     * given value.
     */
  newConst(cst) {
    return this.newConstItem(cst).index;
  }
  /**
     * Adds an UTF8 string to the constant pool of the class being build. Does
     * nothing if the constant pool already contains a similar item. <i>This
     * method is intended for {@link Attribute} sub classes, and is normally not
     * needed by class generators or adapters.</i>
     *
     * @param value
     * the String value.
     * @return the index of a new or already existing UTF8 item.
     */
  newUTF8(value) {
    this.key.set(_ClassWriter.UTF8, value, null, null);
    let result = this.get(this.key);
    if (result == null) {
      this.pool.putByte(_ClassWriter.UTF8).putUTF8(value);
      result = new Item(this.index++, this.key);
      this.put(result);
    }
    return result.index;
  }
  /**
     * Adds a class reference to the constant pool of the class being build.
     * Does nothing if the constant pool already contains a similar item.
     * <i>This method is intended for {@link Attribute} sub classes, and is
     * normally not needed by class generators or adapters.</i>
     *
     * @param value
     * the internal name of the class.
     * @return a new or already existing class reference item.
     */
  newClassItem(value) {
    this.key2.set(_ClassWriter.CLASS, value, null, null);
    let result = this.get(this.key2);
    if (result == null) {
      this.pool.put12(_ClassWriter.CLASS, this.newUTF8(value));
      result = new Item(this.index++, this.key2);
      this.put(result);
    }
    return result;
  }
  /**
     * Adds a class reference to the constant pool of the class being build.
     * Does nothing if the constant pool already contains a similar item.
     * <i>This method is intended for {@link Attribute} sub classes, and is
     * normally not needed by class generators or adapters.</i>
     *
     * @param value
     * the internal name of the class.
     * @return the index of a new or already existing class reference item.
     */
  newClass(value) {
    return this.newClassItem(value).index;
  }
  /**
     * Adds a method type reference to the constant pool of the class being
     * build. Does nothing if the constant pool already contains a similar item.
     * <i>This method is intended for {@link Attribute} sub classes, and is
     * normally not needed by class generators or adapters.</i>
     *
     * @param methodDesc
     * method descriptor of the method type.
     * @return a new or already existing method type reference item.
     */
  newMethodTypeItem(methodDesc) {
    this.key2.set(_ClassWriter.MTYPE, methodDesc, null, null);
    let result = this.get(this.key2);
    if (result == null) {
      this.pool.put12(_ClassWriter.MTYPE, this.newUTF8(methodDesc));
      result = new Item(this.index++, this.key2);
      this.put(result);
    }
    return result;
  }
  /**
     * Adds a method type reference to the constant pool of the class being
     * build. Does nothing if the constant pool already contains a similar item.
     * <i>This method is intended for {@link Attribute} sub classes, and is
     * normally not needed by class generators or adapters.</i>
     *
     * @param methodDesc
     * method descriptor of the method type.
     * @return the index of a new or already existing method type reference
     * item.
     */
  newMethodType(methodDesc) {
    return this.newMethodTypeItem(methodDesc).index;
  }
  /**
     * Adds a handle to the constant pool of the class being build. Does nothing
     * if the constant pool already contains a similar item. <i>This method is
     * intended for {@link Attribute} sub classes, and is normally not needed by
     * class generators or adapters.</i>
     *
     * @param tag
     * the kind of this handle. Must be {@link Opcodes#H_GETFIELD},
     * {@link Opcodes#H_GETSTATIC}, {@link Opcodes#H_PUTFIELD},
     * {@link Opcodes#H_PUTSTATIC}, {@link Opcodes#H_INVOKEVIRTUAL},
     * {@link Opcodes#H_INVOKESTATIC},
     * {@link Opcodes#H_INVOKESPECIAL},
     * {@link Opcodes#H_NEWINVOKESPECIAL} or
     * {@link Opcodes#H_INVOKEINTERFACE}.
     * @param owner
     * the internal name of the field or method owner class.
     * @param name
     * the name of the field or method.
     * @param desc
     * the descriptor of the field or method.
     * @param itf
     * true if the owner is an interface.
     * @return a new or an already existing method type reference item.
     */
  newHandleItem(tag, owner, name, desc, itf) {
    this.key4.set(_ClassWriter.HANDLE_BASE + tag, owner, name, desc);
    let result = this.get(this.key4);
    if (result == null) {
      if (tag <= 4 /* H_PUTSTATIC */) {
        this.put112(_ClassWriter.HANDLE, tag, this.newField(owner, name, desc));
      } else {
        this.put112(_ClassWriter.HANDLE, tag, this.newMethod(owner, name, desc, itf));
      }
      result = new Item(this.index++, this.key4);
      this.put(result);
    }
    return result;
  }
  /**
     * Adds a handle to the constant pool of the class being build. Does nothing
     * if the constant pool already contains a similar item. <i>This method is
     * intended for {@link Attribute} sub classes, and is normally not needed by
     * class generators or adapters.</i>
     *
     * @param tag
     * the kind of this handle. Must be {@link Opcodes#H_GETFIELD},
     * {@link Opcodes#H_GETSTATIC}, {@link Opcodes#H_PUTFIELD},
     * {@link Opcodes#H_PUTSTATIC}, {@link Opcodes#H_INVOKEVIRTUAL},
     * {@link Opcodes#H_INVOKESTATIC},
     * {@link Opcodes#H_INVOKESPECIAL},
     * {@link Opcodes#H_NEWINVOKESPECIAL} or
     * {@link Opcodes#H_INVOKEINTERFACE}.
     * @param owner
     * the internal name of the field or method owner class.
     * @param name
     * the name of the field or method.
     * @param desc
     * the descriptor of the field or method.
     * @return the index of a new or already existing method type reference
     * item.
     *
     * @deprecated this method is superseded by
     * {@link #newHandle(int, String, String, String, boolean)}.
     */
  newHandle$int$java_lang_String$java_lang_String$java_lang_String(tag, owner, name, desc) {
    return this.newHandle(tag, owner, name, desc, tag === 9 /* H_INVOKEINTERFACE */);
  }
  /**
     * Adds a handle to the constant pool of the class being build. Does nothing
     * if the constant pool already contains a similar item. <i>This method is
     * intended for {@link Attribute} sub classes, and is normally not needed by
     * class generators or adapters.</i>
     *
     * @param tag
     * the kind of this handle. Must be {@link Opcodes#H_GETFIELD},
     * {@link Opcodes#H_GETSTATIC}, {@link Opcodes#H_PUTFIELD},
     * {@link Opcodes#H_PUTSTATIC}, {@link Opcodes#H_INVOKEVIRTUAL},
     * {@link Opcodes#H_INVOKESTATIC},
     * {@link Opcodes#H_INVOKESPECIAL},
     * {@link Opcodes#H_NEWINVOKESPECIAL} or
     * {@link Opcodes#H_INVOKEINTERFACE}.
     * @param owner
     * the internal name of the field or method owner class.
     * @param name
     * the name of the field or method.
     * @param desc
     * the descriptor of the field or method.
     * @param itf
     * true if the owner is an interface.
     * @return the index of a new or already existing method type reference
     * item.
     */
  newHandle(tag, owner, name, desc, itf) {
    if ((typeof tag === "number" || tag === null) && (typeof owner === "string" || owner === null) && (typeof name === "string" || name === null) && (typeof desc === "string" || desc === null) && (typeof itf === "boolean" || itf === null)) {
      const __args = Array.prototype.slice.call(arguments);
      return (() => {
        return this.newHandleItem(tag, owner, name, desc, itf).index;
      })();
    } else if ((typeof tag === "number" || tag === null) && (typeof owner === "string" || owner === null) && (typeof name === "string" || name === null) && (typeof desc === "string" || desc === null) && itf === void 0) {
      return this.newHandle$int$java_lang_String$java_lang_String$java_lang_String(tag, owner, name, desc);
    } else {
      throw new Error("invalid overload");
    }
  }
  /**
     * Adds an invokedynamic reference to the constant pool of the class being
     * build. Does nothing if the constant pool already contains a similar item.
     * <i>This method is intended for {@link Attribute} sub classes, and is
     * normally not needed by class generators or adapters.</i>
     *
     * @param name
     * name of the invoked method.
     * @param desc
     * descriptor of the invoke method.
     * @param bsm
     * the bootstrap method.
     * @param bsmArgs
     * the bootstrap method constant arguments.
     *
     * @return a new or an already existing invokedynamic type reference item.
     */
  newInvokeDynamicItem(name, desc, bsm, ...bsmArgs) {
    let bootstrapMethods = this.bootstrapMethods;
    if (bootstrapMethods == null) {
      bootstrapMethods = this.bootstrapMethods = new ByteVector();
    }
    const position = bootstrapMethods.length;
    let hashCode = bsm.hashCode();
    bootstrapMethods.putShort(this.newHandle(bsm.tag, bsm.owner, bsm.name, bsm.descriptor, bsm.isInterface));
    const argsLength = bsmArgs.length;
    bootstrapMethods.putShort(argsLength);
    for (let i = 0; i < argsLength; i++) {
      const bsmArg = bsmArgs[i];
      hashCode ^= bsmArg.toString();
      bootstrapMethods.putShort(this.newConst(bsmArg));
    }
    const data = bootstrapMethods.data;
    const length = 1 + 1 + argsLength << 1;
    hashCode &= 2147483647;
    let result = this.items[hashCode % this.items.length];
    loop:
      while (result != null) {
        if (result.type !== _ClassWriter.BSM || result.__hashCode !== hashCode) {
          result = result.next;
          continue;
        }
        const resultPosition = result.intVal;
        for (let p = 0; p < length; p++) {
          if (data[position + p] !== data[resultPosition + p]) {
            result = result.next;
            continue loop;
          }
        }
        break;
      }
    let bootstrapMethodIndex;
    if (result != null) {
      bootstrapMethodIndex = result.index;
      bootstrapMethods.length = position;
    } else {
      bootstrapMethodIndex = this.bootstrapMethodsCount++;
      result = new Item(bootstrapMethodIndex);
      result.setPosHash(position, hashCode);
      this.put(result);
    }
    this.key3.setInvkDynItem(name, desc, bootstrapMethodIndex);
    result = this.get(this.key3);
    if (result == null) {
      this.put122(_ClassWriter.INDY, bootstrapMethodIndex, this.newNameType(name, desc));
      result = new Item(this.index++, this.key3);
      this.put(result);
    }
    return result;
  }
  /**
     * Adds an invokedynamic reference to the constant pool of the class being
     * build. Does nothing if the constant pool already contains a similar item.
     * <i>This method is intended for {@link Attribute} sub classes, and is
     * normally not needed by class generators or adapters.</i>
     *
     * @param name
     * name of the invoked method.
     * @param desc
     * descriptor of the invoke method.
     * @param bsm
     * the bootstrap method.
     * @param bsmArgs
     * the bootstrap method constant arguments.
     *
     * @return the index of a new or already existing invokedynamic reference
     * item.
     */
  newInvokeDynamic(name, desc, bsm, ...bsmArgs) {
    return this.newInvokeDynamicItem.apply(this, [name, desc, bsm].concat(bsmArgs)).index;
  }
  /**
     * Adds a field reference to the constant pool of the class being build.
     * Does nothing if the constant pool already contains a similar item.
     *
     * @param owner
     * the internal name of the field's owner class.
     * @param name
     * the field's name.
     * @param desc
     * the field's descriptor.
     * @return a new or already existing field reference item.
     */
  newFieldItem(owner, name, desc) {
    this.key3.set(_ClassWriter.FIELD, owner, name, desc);
    let result = this.get(this.key3);
    if (result == null) {
      this.put122(_ClassWriter.FIELD, this.newClass(owner), this.newNameType(name, desc));
      result = new Item(this.index++, this.key3);
      this.put(result);
    }
    return result;
  }
  /**
     * Adds a field reference to the constant pool of the class being build.
     * Does nothing if the constant pool already contains a similar item.
     * <i>This method is intended for {@link Attribute} sub classes, and is
     * normally not needed by class generators or adapters.</i>
     *
     * @param owner
     * the internal name of the field's owner class.
     * @param name
     * the field's name.
     * @param desc
     * the field's descriptor.
     * @return the index of a new or already existing field reference item.
     */
  newField(owner, name, desc) {
    return this.newFieldItem(owner, name, desc).index;
  }
  /**
     * Adds a method reference to the constant pool of the class being build.
     * Does nothing if the constant pool already contains a similar item.
     *
     * @param owner
     * the internal name of the method's owner class.
     * @param name
     * the method's name.
     * @param desc
     * the method's descriptor.
     * @param itf
     * <tt>true</tt> if <tt>owner</tt> is an interface.
     * @return a new or already existing method reference item.
     */
  newMethodItem(owner, name, desc, itf) {
    const type = itf ? _ClassWriter.IMETH : _ClassWriter.METH;
    this.key3.set(type, owner, name, desc);
    let result = this.get(this.key3);
    if (result == null) {
      this.put122(type, this.newClass(owner), this.newNameType(name, desc));
      result = new Item(this.index++, this.key3);
      this.put(result);
    }
    return result;
  }
  /**
     * Adds a method reference to the constant pool of the class being build.
     * Does nothing if the constant pool already contains a similar item.
     * <i>This method is intended for {@link Attribute} sub classes, and is
     * normally not needed by class generators or adapters.</i>
     *
     * @param owner
     * the internal name of the method's owner class.
     * @param name
     * the method's name.
     * @param desc
     * the method's descriptor.
     * @param itf
     * <tt>true</tt> if <tt>owner</tt> is an interface.
     * @return the index of a new or already existing method reference item.
     */
  newMethod(owner, name, desc, itf) {
    return this.newMethodItem(owner, name, desc, itf).index;
  }
  /**
     * Adds an integer to the constant pool of the class being build. Does
     * nothing if the constant pool already contains a similar item.
     *
     * @param value
     * the int value.
     * @return a new or already existing int item.
     */
  newInteger(value) {
    this.key.set$int(value);
    let result = this.get(this.key);
    if (result == null) {
      this.pool.putByte(_ClassWriter.INT).putInt(value);
      result = new Item(this.index++, this.key);
      this.put(result);
    }
    return result;
  }
  /**
     * Adds a float to the constant pool of the class being build. Does nothing
     * if the constant pool already contains a similar item.
     *
     * @param value
     * the float value.
     * @return a new or already existing float item.
     */
  newFloat(value) {
    this.key.set$float(value);
    let result = this.get(this.key);
    if (result == null) {
      this.pool.putByte(_ClassWriter.FLOAT).putInt(this.key.intVal);
      result = new Item(this.index++, this.key);
      this.put(result);
    }
    return result;
  }
  /**
     * Adds a long to the constant pool of the class being build. Does nothing
     * if the constant pool already contains a similar item.
     *
     * @param value
     * the long value.
     * @return a new or already existing long item.
     */
  newLong(value) {
    this.key.set$long(value);
    let result = this.get(this.key);
    if (result == null) {
      this.pool.putByte(_ClassWriter.LONG).putLong(value);
      result = new Item(this.index, this.key);
      this.index += 2;
      this.put(result);
    }
    return result;
  }
  /**
     * Adds a double to the constant pool of the class being build. Does nothing
     * if the constant pool already contains a similar item.
     *
     * @param value
     * the double value.
     * @return a new or already existing double item.
     */
  newDouble(value) {
    this.key.set$double(value);
    let result = this.get(this.key);
    if (result == null) {
      this.pool.putByte(_ClassWriter.DOUBLE).putLong(this.key.longVal);
      result = new Item(this.index, this.key);
      this.index += 2;
      this.put(result);
    }
    return result;
  }
  /**
     * Adds a string to the constant pool of the class being build. Does nothing
     * if the constant pool already contains a similar item.
     *
     * @param value
     * the String value.
     * @return a new or already existing string item.
     */
  newString(value) {
    this.key2.set(_ClassWriter.STR, value, null, null);
    let result = this.get(this.key2);
    if (result == null) {
      this.pool.put12(_ClassWriter.STR, this.newUTF8(value));
      result = new Item(this.index++, this.key2);
      this.put(result);
    }
    return result;
  }
  /**
     * Adds a name and type to the constant pool of the class being build. Does
     * nothing if the constant pool already contains a similar item. <i>This
     * method is intended for {@link Attribute} sub classes, and is normally not
     * needed by class generators or adapters.</i>
     *
     * @param name
     * a name.
     * @param desc
     * a type descriptor.
     * @return the index of a new or already existing name and type item.
     */
  newNameType(name, desc) {
    return this.newNameTypeItem(name, desc).index;
  }
  /**
     * Adds a name and type to the constant pool of the class being build. Does
     * nothing if the constant pool already contains a similar item.
     *
     * @param name
     * a name.
     * @param desc
     * a type descriptor.
     * @return a new or already existing name and type item.
     */
  newNameTypeItem(name, desc) {
    this.key2.set(_ClassWriter.NAME_TYPE, name, desc, null);
    let result = this.get(this.key2);
    if (result == null) {
      this.put122(_ClassWriter.NAME_TYPE, this.newUTF8(name), this.newUTF8(desc));
      result = new Item(this.index++, this.key2);
      this.put(result);
    }
    return result;
  }
  /**
     * Adds the given internal name to {@link #typeTable} and returns its index.
     * Does nothing if the type table already contains this internal name.
     *
     * @param type
     * the internal name to be added to the type table.
     * @return the index of this internal name in the type table.
     */
  addType(type) {
    if (typeof type === "string" || type === null) {
      const __args = Array.prototype.slice.call(arguments);
      return (() => {
        this.key.set(_ClassWriter.TYPE_NORMAL, type, null, null);
        let result = this.get(this.key);
        if (result == null) {
          result = this.addType(this.key);
        }
        return result.index;
      })();
    } else if (type != null && type instanceof Item || type === null) {
      return this.addType$Item(type);
    } else {
      throw new Error("invalid overload");
    }
  }
  /**
     * Adds the given "uninitialized" type to {@link #typeTable} and returns its
     * index. This method is used for UNINITIALIZED types, made of an internal
     * name and a bytecode offset.
     *
     * @param type
     * the internal name to be added to the type table.
     * @param offset
     * the bytecode offset of the NEW instruction that created this
     * UNINITIALIZED type value.
     * @return the index of this internal name in the type table.
     */
  addUninitializedType(type, offset) {
    this.key.type = _ClassWriter.TYPE_UNINIT;
    this.key.intVal = offset;
    this.key.strVal1 = type;
    this.key.__hashCode = 2147483647 & _ClassWriter.TYPE_UNINIT + type.toString() + offset;
    let result = this.get(this.key);
    if (result == null) {
      result = this.addType(this.key);
    }
    return result.index;
  }
  /**
     * Adds the given Item to {@link #typeTable}.
     *
     * @param item
     * the value to be added to the type table.
     * @return the added Item, which a new Item instance with the same value as
     * the given Item.
     */
  addType$Item(item) {
    throw new Error("not supported");
  }
  /**
     * Returns the index of the common super type of the two given types. This
     * method calls {@link #getCommonSuperClass} and caches the result in the
     * {@link #items} hash table to speedup future calls with the same
     * parameters.
     *
     * @param type1
     * index of an internal name in {@link #typeTable}.
     * @param type2
     * index of an internal name in {@link #typeTable}.
     * @return the index of the common super type of the two given types.
     */
  getMergedType(type1, type2) {
    throw new Error("not supported");
  }
  /**
     * Returns the common super type of the two given types. The default
     * implementation of this method <i>loads</i> the two given classes and uses
     * the java.lang.Class methods to find the common super class. It can be
     * overridden to compute this common super type in other ways, in particular
     * without actually loading any class, or to take into account the class
     * that is currently being generated by this ClassWriter, which can of
     * course not be loaded since it is under construction.
     *
     * @param type1
     * the internal name of a class.
     * @param type2
     * the internal name of another class.
     * @return the internal name of the common super class of the two given
     * classes.
     */
  getCommonSuperClass(type1, type2) {
    return "java/lang/Object";
  }
  /**
     * Returns the constant pool's hash table item which is equal to the given
     * item.
     *
     * @param key
     * a constant pool item.
     * @return the constant pool's hash table item which is equal to the given
     * item, or <tt>null</tt> if there is no such item.
     */
  get(key) {
    let i = this.items[key.__hashCode % this.items.length];
    while (i != null && (i.type !== key.type || !key.isEqualTo(i))) {
      i = i.next;
    }
    return i;
  }
  /**
     * Puts the given item in the constant pool's hash table. The hash table
     * <i>must</i> not already contains this item.
     *
     * @param i
     * the item to be added to the constant pool's hash table.
     */
  put(i) {
    if (this.index + this.typeCount > this.threshold) {
      const ll = this.items.length;
      const nl = ll * 2 + 1;
      const newItems = new Array(nl);
      for (let l = ll - 1; l >= 0; --l) {
        let j = this.items[l];
        while (j != null) {
          const index2 = j.__hashCode % newItems.length;
          const k = j.next;
          j.next = newItems[index2];
          newItems[index2] = j;
          j = k;
        }
      }
      this.items = newItems;
      this.threshold = nl * 0.75 | 0;
    }
    const index = i.__hashCode % this.items.length;
    i.next = this.items[index];
    this.items[index] = i;
  }
  /**
     * Puts one byte and two shorts into the constant pool.
     *
     * @param b
     * a byte.
     * @param s1
     * a short.
     * @param s2
     * another short.
     */
  put122(b, s1, s2) {
    this.pool.put12(b, s1).putShort(s2);
  }
  /**
     * Puts two bytes and one short into the constant pool.
     *
     * @param b1
     * a byte.
     * @param b2
     * another byte.
     * @param s
     * a short.
     */
  put112(b1, b2, s) {
    this.pool.put11(b1, b2).putShort(s);
  }
};
var ClassWriter = _ClassWriter;
__publicField(ClassWriter, "__static_initialized", false);
/**
   * Flag to automatically compute the maximum stack size and the maximum
   * number of local variables of methods. If this flag is set, then the
   * arguments of the {@link MethodVisitor#visitMaxs visitMaxs} method of the
   * {@link MethodVisitor} returned by the {@link #visitMethod visitMethod}
   * method will be ignored, and computed automatically from the signature and
   * the bytecode of each method.
   *
   * @see #ClassWriter(int)
   */
__publicField(ClassWriter, "COMPUTE_MAXS", 1);
/**
   * Flag to automatically compute the stack map frames of methods from
   * scratch. If this flag is set, then the calls to the
   * {@link MethodVisitor#visitFrame} method are ignored, and the stack map
   * frames are recomputed from the methods bytecode. The arguments of the
   * {@link MethodVisitor#visitMaxs visitMaxs} method are also ignored and
   * recomputed from the bytecode. In other words, COMPUTE_FRAMES implies
   * COMPUTE_MAXS.
   *
   * @see #ClassWriter(int)
   */
__publicField(ClassWriter, "COMPUTE_FRAMES", 2);
/**
   * Pseudo access flag to distinguish between the synthetic attribute and the
   * synthetic access flag.
   */
__publicField(ClassWriter, "ACC_SYNTHETIC_ATTRIBUTE", 262144);
/**
   * Factor to convert from ACC_SYNTHETIC_ATTRIBUTE to Opcode.ACC_SYNTHETIC.
   */
__publicField(ClassWriter, "TO_ACC_SYNTHETIC");
/**
   * The type of instructions without any argument.
   */
__publicField(ClassWriter, "NOARG_INSN", 0);
/**
   * The type of instructions with an signed byte argument.
   */
__publicField(ClassWriter, "SBYTE_INSN", 1);
/**
   * The type of instructions with an signed short argument.
   */
__publicField(ClassWriter, "SHORT_INSN", 2);
/**
   * The type of instructions with a local variable index argument.
   */
__publicField(ClassWriter, "VAR_INSN", 3);
/**
   * The type of instructions with an implicit local variable index argument.
   */
__publicField(ClassWriter, "IMPLVAR_INSN", 4);
/**
   * The type of instructions with a type descriptor argument.
   */
__publicField(ClassWriter, "TYPE_INSN", 5);
/**
   * The type of field and method invocations instructions.
   */
__publicField(ClassWriter, "FIELDORMETH_INSN", 6);
/**
   * The type of the INVOKEINTERFACE/INVOKEDYNAMIC instruction.
   */
__publicField(ClassWriter, "ITFMETH_INSN", 7);
/**
   * The type of the INVOKEDYNAMIC instruction.
   */
__publicField(ClassWriter, "INDYMETH_INSN", 8);
/**
   * The type of instructions with a 2 bytes bytecode offset label.
   */
__publicField(ClassWriter, "LABEL_INSN", 9);
/**
   * The type of instructions with a 4 bytes bytecode offset label.
   */
__publicField(ClassWriter, "LABELW_INSN", 10);
/**
   * The type of the LDC instruction.
   */
__publicField(ClassWriter, "LDC_INSN", 11);
/**
   * The type of the LDC_W and LDC2_W instructions.
   */
__publicField(ClassWriter, "LDCW_INSN", 12);
/**
   * The type of the IINC instruction.
   */
__publicField(ClassWriter, "IINC_INSN", 13);
/**
   * The type of the TABLESWITCH instruction.
   */
__publicField(ClassWriter, "TABL_INSN", 14);
/**
   * The type of the LOOKUPSWITCH instruction.
   */
__publicField(ClassWriter, "LOOK_INSN", 15);
/**
   * The type of the MULTIANEWARRAY instruction.
   */
__publicField(ClassWriter, "MANA_INSN", 16);
/**
   * The type of the WIDE instruction.
   */
__publicField(ClassWriter, "WIDE_INSN", 17);
/**
   * The type of the ASM pseudo instructions with an unsigned 2 bytes offset
   * label (see Label#resolve).
   */
__publicField(ClassWriter, "ASM_LABEL_INSN", 18);
/**
   * Represents a frame inserted between already existing frames. This kind of
   * frame can only be used if the frame content can be computed from the
   * previous existing frame and from the instructions between this existing
   * frame and the inserted one, without any knowledge of the type hierarchy.
   * This kind of frame is only used when an unconditional jump is inserted in
   * a method while expanding an ASM pseudo instruction (see ClassReader).
   */
__publicField(ClassWriter, "F_INSERT", 256);
/**
   * The instruction types of all JVM opcodes.
   */
__publicField(ClassWriter, "TYPE");
/**
   * The type of CONSTANT_Class constant pool items.
   */
__publicField(ClassWriter, "CLASS", 7);
/**
   * The type of CONSTANT_Fieldref constant pool items.
   */
__publicField(ClassWriter, "FIELD", 9);
/**
   * The type of CONSTANT_Methodref constant pool items.
   */
__publicField(ClassWriter, "METH", 10);
/**
   * The type of CONSTANT_InterfaceMethodref constant pool items.
   */
__publicField(ClassWriter, "IMETH", 11);
/**
   * The type of CONSTANT_String constant pool items.
   */
__publicField(ClassWriter, "STR", 8);
/**
   * The type of CONSTANT_Integer constant pool items.
   */
__publicField(ClassWriter, "INT", 3);
/**
   * The type of CONSTANT_Float constant pool items.
   */
__publicField(ClassWriter, "FLOAT", 4);
/**
   * The type of CONSTANT_Long constant pool items.
   */
__publicField(ClassWriter, "LONG", 5);
/**
   * The type of CONSTANT_Double constant pool items.
   */
__publicField(ClassWriter, "DOUBLE", 6);
/**
   * The type of CONSTANT_NameAndType constant pool items.
   */
__publicField(ClassWriter, "NAME_TYPE", 12);
/**
   * The type of CONSTANT_Utf8 constant pool items.
   */
__publicField(ClassWriter, "UTF8", 1);
/**
   * The type of CONSTANT_MethodType constant pool items.
   */
__publicField(ClassWriter, "MTYPE", 16);
/**
   * The type of CONSTANT_MethodHandle constant pool items.
   */
__publicField(ClassWriter, "HANDLE", 15);
/**
   * The type of CONSTANT_InvokeDynamic constant pool items.
   */
__publicField(ClassWriter, "INDY", 18);
/**
   * The base value for all CONSTANT_MethodHandle constant pool items.
   * Internally, ASM store the 9 variations of CONSTANT_MethodHandle into 9
   * different items.
   */
__publicField(ClassWriter, "HANDLE_BASE", 20);
/**
   * Normal type Item stored in the ClassWriter {@link ClassWriter#typeTable},
   * instead of the constant pool, in order to avoid clashes with normal
   * constant pool items in the ClassWriter constant pool's hash table.
   */
__publicField(ClassWriter, "TYPE_NORMAL", 30);
/**
   * Uninitialized type Item stored in the ClassWriter
   * {@link ClassWriter#typeTable}, instead of the constant pool, in order to
   * avoid clashes with normal constant pool items in the ClassWriter constant
   * pool's hash table.
   */
__publicField(ClassWriter, "TYPE_UNINIT", 31);
/**
   * Merged type Item stored in the ClassWriter {@link ClassWriter#typeTable},
   * instead of the constant pool, in order to avoid clashes with normal
   * constant pool items in the ClassWriter constant pool's hash table.
   */
__publicField(ClassWriter, "TYPE_MERGED", 32);
/**
   * The type of BootstrapMethods items. These items are stored in a special
   * class attribute named BootstrapMethods and not in the constant pool.
   */
__publicField(ClassWriter, "BSM", 33);
ClassWriter.TYPE_$LI$();
ClassWriter.TO_ACC_SYNTHETIC_$LI$();
ClassWriter.__static_initialize();

// libs/Context.ts
var Context = class {
  constructor(attrs, flags, buffer) {
    /**
       * Prototypes of the attributes that must be parsed for this class.
       */
    __publicField(this, "attrs");
    /**
       * The {@link ClassReader} option flags for the parsing of this class.
       */
    __publicField(this, "flags");
    /**
       * The buffer used to read strings.
       */
    __publicField(this, "buffer");
    /**
       * The start index of each bootstrap method.
       */
    __publicField(this, "bootstrapMethods", []);
    /**
       * The access flags of the method currently being parsed.
       */
    __publicField(this, "access");
    /**
       * The name of the method currently being parsed.
       */
    __publicField(this, "name", "");
    /**
       * The descriptor of the method currently being parsed.
       */
    __publicField(this, "desc", "");
    /**
       * The label objects, indexed by bytecode offset, of the method currently
       * being parsed (only bytecode offsets for which a label is needed have a
       * non null associated Label object).
       */
    __publicField(this, "labels", []);
    /**
       * The target of the type annotation currently being parsed.
       */
    __publicField(this, "typeRef");
    /**
       * The path of the type annotation currently being parsed.
       */
    __publicField(this, "typePath", null);
    /**
       * The offset of the latest stack map frame that has been parsed.
       */
    __publicField(this, "offset");
    /**
       * The labels corresponding to the start of the local variable ranges in the
       * local variable type annotation currently being parsed.
       */
    __publicField(this, "start", []);
    /**
       * The labels corresponding to the end of the local variable ranges in the
       * local variable type annotation currently being parsed.
       */
    __publicField(this, "end", []);
    /**
       * The local variable indices for each local variable range in the local
       * variable type annotation currently being parsed.
       */
    __publicField(this, "index", []);
    /**
       * The encoding of the latest stack map frame that has been parsed.
       */
    __publicField(this, "mode");
    /**
       * The number of locals in the latest stack map frame that has been parsed.
       */
    __publicField(this, "localCount");
    /**
       * The number locals in the latest stack map frame that has been parsed,
       * minus the number of locals in the previous frame.
       */
    __publicField(this, "localDiff");
    /**
       * The local values of the latest stack map frame that has been parsed.
       */
    __publicField(this, "local", []);
    /**
       * The stack size of the latest stack map frame that has been parsed.
       */
    __publicField(this, "stackCount");
    /**
       * The stack values of the latest stack map frame that has been parsed.
       */
    __publicField(this, "stack", []);
    this.access = 0;
    this.typeRef = 0;
    this.offset = 0;
    this.mode = 0;
    this.localCount = 0;
    this.localDiff = 0;
    this.stackCount = 0;
    this.attrs = attrs;
    this.flags = flags;
    this.buffer = buffer;
  }
};

// libs/Handle.ts
var Handle = class {
  /**
     * Constructs a new field or method handle.
     *
     * @param tag
     * the kind of field or method designated by this Handle. Must be
     * {@link Opcodes#H_GETFIELD}, {@link Opcodes#H_GETSTATIC},
     * {@link Opcodes#H_PUTFIELD}, {@link Opcodes#H_PUTSTATIC},
     * {@link Opcodes#H_INVOKEVIRTUAL},
     * {@link Opcodes#H_INVOKESTATIC},
     * {@link Opcodes#H_INVOKESPECIAL},
     * {@link Opcodes#H_NEWINVOKESPECIAL} or
     * {@link Opcodes#H_INVOKEINTERFACE}.
     * @param owner
     * the internal name of the class that owns the field or method
     * designated by this handle.
     * @param name
     * the name of the field or method designated by this handle.
     * @param desc
     * the descriptor of the field or method designated by this
     * handle.
     * @param itf
     * true if the owner is an interface.
     */
  constructor(tag, owner, name, desc, itf = tag === 9 /* H_INVOKEINTERFACE */) {
    /**
       * The kind of field or method designated by this Handle. Should be
       * {@link Opcodes#H_GETFIELD}, {@link Opcodes#H_GETSTATIC},
       * {@link Opcodes#H_PUTFIELD}, {@link Opcodes#H_PUTSTATIC},
       * {@link Opcodes#H_INVOKEVIRTUAL}, {@link Opcodes#H_INVOKESTATIC},
       * {@link Opcodes#H_INVOKESPECIAL}, {@link Opcodes#H_NEWINVOKESPECIAL} or
       * {@link Opcodes#H_INVOKEINTERFACE}.
       */
    __publicField(this, "tag");
    /**
       * The internal name of the class that owns the field or method designated
       * by this handle.
       */
    __publicField(this, "owner");
    /**
       * The name of the field or method designated by this handle.
       */
    __publicField(this, "name");
    /**
       * The descriptor of the field or method designated by this handle.
       */
    __publicField(this, "descriptor");
    /**
       * Indicate if the owner is an interface or not.
       */
    __publicField(this, "isInterface");
    this.tag = tag;
    this.owner = owner;
    this.name = name;
    this.descriptor = desc;
    this.isInterface = itf;
  }
  equals(obj) {
    if (obj === this) {
      return true;
    }
    if (!(obj != null && obj instanceof Handle)) {
      return false;
    }
    const h = obj;
    return this.tag === h.tag && this.isInterface === h.isInterface && this.owner === h.owner && this.name === h.name && this.descriptor === h.descriptor;
  }
  hashCode() {
    return this.tag + (this.isInterface ? 64 : 0) + this.owner.toString() * this.name.toString() * this.descriptor.toString();
  }
  /**
     * Returns the textual representation of this handle. The textual
     * representation is:
     *
     * <pre>
     * for a reference to a class:
     * owner '.' name desc ' ' '(' tag ')'
     * for a reference to an interface:
     * owner '.' name desc ' ' '(' tag ' ' itf ')'
     * </pre>
     *
     * . As this format is unambiguous, it can be parsed if necessary.
     */
  toString() {
    return this.owner + "." + this.name + this.descriptor + " (" + this.tag + (this.isInterface ? " itf" : "") + ")";
  }
};

// libs/TypePath.ts
var _TypePath = class {
  /**
     * Creates a new type path.
     *
     * @param b
     * the byte array containing the type path in Java class file
     * format.
     * @param offset
     * the offset of the first byte of the type path in 'b'.
     */
  constructor(b, offset) {
    /**
       * The byte array where the path is stored, in Java class file format.
       */
    __publicField(this, "buf");
    /**
       * The offset of the first byte of the type path in 'b'.
       */
    __publicField(this, "offset");
    this.offset = 0;
    this.buf = b;
    this.offset = offset;
  }
  /**
        * Returns the length of this path.
        *
        * @return the length of this path.
        */
  get length() {
    return this.buf[this.offset];
  }
  /**
     * Returns the value of the given step of this path.
     *
     * @param index
     * an index between 0 and {@link #getLength()}, exclusive.
     * @return {@link #ARRAY_ELEMENT ARRAY_ELEMENT}, {@link #INNER_TYPE
     * INNER_TYPE}, {@link #WILDCARD_BOUND WILDCARD_BOUND}, or
     * {@link #TYPE_ARGUMENT TYPE_ARGUMENT}.
     */
  getStep(index) {
    return this.buf[this.offset + 2 * index + 1];
  }
  /**
     * Returns the index of the type argument that the given step is stepping
     * into. This method should only be used for steps whose value is
     * {@link #TYPE_ARGUMENT TYPE_ARGUMENT}.
     *
     * @param index
     * an index between 0 and {@link #getLength()}, exclusive.
     * @return the index of the type argument that the given step is stepping
     * into.
     */
  getStepArgument(index) {
    return this.buf[this.offset + 2 * index + 2];
  }
  /**
     * Converts a type path in string form, in the format used by
     * {@link #toString()}, into a TypePath object.
     *
     * @param typePath
     * a type path in string form, in the format used by
     * {@link #toString()}. May be null or empty.
     * @return the corresponding TypePath object, or null if the path is empty.
     */
  static fromString(typePath) {
    if (typePath == null || typePath.length === 0) {
      return null;
    }
    const n = typePath.length;
    const out = new ByteVector(n);
    out.putByte(0);
    for (let i = 0; i < n; ) {
      let c = typePath.charAt(i++);
      if (c === "[") {
        out.put11(_TypePath.ARRAY_ELEMENT, 0);
      } else if (c === ".") {
        out.put11(_TypePath.INNER_TYPE, 0);
      } else if (c === "*") {
        out.put11(_TypePath.WILDCARD_BOUND, 0);
      } else if (c.charCodeAt(0) >= "0".charCodeAt(0) && c.charCodeAt(0) <= "9".charCodeAt(0)) {
        let typeArg = c.charCodeAt(0) - "0".charCodeAt(0);
        while (i < n && (c = typePath.charAt(i)).charCodeAt(0) >= "0".charCodeAt(0) && c.charCodeAt(0) <= "9".charCodeAt(0)) {
          typeArg = typeArg * 10 + c.charCodeAt(0) - "0".charCodeAt(0);
          i += 1;
        }
        if (i < n && typePath.charAt(i) === ";") {
          i += 1;
        }
        out.put11(_TypePath.TYPE_ARGUMENT, typeArg);
      }
    }
    out.data[0] = out.length / 2 | 0 | 0;
    return new _TypePath(out.data, 0);
  }
  /**
     * Returns a string representation of this type path. {@link #ARRAY_ELEMENT
     * ARRAY_ELEMENT} steps are represented with '[', {@link #INNER_TYPE
     * INNER_TYPE} steps with '.', {@link #WILDCARD_BOUND WILDCARD_BOUND} steps
     * with '*' and {@link #TYPE_ARGUMENT TYPE_ARGUMENT} steps with their type
     * argument index in decimal form followed by ';'.
     */
  toString() {
    const length = this.length;
    let result = "";
    for (let i = 0; i < length; ++i) {
      switch (this.getStep(i)) {
        case _TypePath.ARRAY_ELEMENT:
          result += "[";
          break;
        case _TypePath.INNER_TYPE:
          result += ".";
          break;
        case _TypePath.WILDCARD_BOUND:
          result += "*";
          break;
        case _TypePath.TYPE_ARGUMENT:
          result += this.getStepArgument(i) + ";";
          break;
        default:
          result += "_";
      }
    }
    return result.toString();
  }
};
var TypePath = _TypePath;
/**
   * A type path step that steps into the element type of an array type. See
   * {@link #getStep getStep}.
   */
__publicField(TypePath, "ARRAY_ELEMENT", 0);
/**
   * A type path step that steps into the nested type of a class type. See
   * {@link #getStep getStep}.
   */
__publicField(TypePath, "INNER_TYPE", 1);
/**
   * A type path step that steps into the bound of a wildcard type. See
   * {@link #getStep getStep}.
   */
__publicField(TypePath, "WILDCARD_BOUND", 2);
/**
   * A type path step that steps into a type argument of a generic type. See
   * {@link #getStep getStep}.
   */
__publicField(TypePath, "TYPE_ARGUMENT", 3);

// libs/ClassReader.ts
var _ClassReader = class {
  /**
     * Constructs a new {@link ClassReader} object.
     *
     * @param b   the bytecode of the class to be read.
     * @param off the start offset of the class data.
     * @param len the length of the class data.
     */
  constructor(buffer, classFileOffset = 0, len = buffer.length) {
    /**
       * The class to be parsed. <i>The content of this array must not be
       * modified. This field is intended for {@link Attribute} sub classes, and
       * is normally not needed by class generators or adapters.</i>
       */
    __publicField(this, "buf");
    /**
       * The start index of each constant pool item in {@link #b b}, plus one. The
       * one byte offset skips the constant pool item tag that indicates its type.
       */
    __publicField(this, "items");
    /**
       * The String objects corresponding to the CONSTANT_Utf8 items. This cache
       * avoids multiple parsing of a given CONSTANT_Utf8 constant pool item,
       * which GREATLY improves performances (by a factor 2 to 3). This caching
       * strategy could be extended to all constant pool items, but its benefit
       * would not be so great for these items (because they are much less
       * expensive to parse than CONSTANT_Utf8 items).
       */
    __publicField(this, "strings");
    /**
       * Maximum length of the strings contained in the constant pool of the
       * class.
       */
    __publicField(this, "maxStringLength");
    /**
       * Start index of the class header information (access, name...) in
       * {@link #b b}.
       */
    __publicField(this, "header");
    this.maxStringLength = 0;
    this.header = 0;
    this.buf = buffer;
    this.items = new Array(this.readUnsignedShort(classFileOffset + 8));
    const n = this.items.length;
    this.strings = new Array(n);
    let max = 0;
    let index = classFileOffset + 10;
    for (let i = 1; i < n; ++i) {
      this.items[i] = index + 1;
      let size;
      switch (buffer[index]) {
        case ClassWriter.FIELD:
        case ClassWriter.METH:
        case ClassWriter.IMETH:
        case ClassWriter.INT:
        case ClassWriter.FLOAT:
        case ClassWriter.NAME_TYPE:
        case ClassWriter.INDY:
          size = 5;
          break;
        case ClassWriter.LONG:
        case ClassWriter.DOUBLE:
          size = 9;
          ++i;
          break;
        case ClassWriter.UTF8:
          size = 3 + this.readUnsignedShort(index + 1);
          if (size > max) {
            max = size;
          }
          break;
        case ClassWriter.HANDLE:
          size = 4;
          break;
        default:
          size = 3;
          break;
      }
      index += size;
    }
    this.maxStringLength = max;
    this.header = index;
  }
  /**
     * Returns the class's access flags (see {@link Opcodes}). This value may
     * not reflect Deprecated and Synthetic flags when bytecode is before 1.5
     * and those flags are represented by attributes.
     *
     * @return the class access flags
     * @see ClassVisitor#visit(int, int, String, String, String, String[])
     */
  getAccess() {
    return this.readUnsignedShort(this.header);
  }
  /**
     * Returns the internal name of the class (see
     * {@link Type#getInternalName() getInternalName}).
     *
     * @return the internal class name
     * @see ClassVisitor#visit(int, int, String, String, String, String[])
     */
  getClassName() {
    return this.readClass(this.header + 2, new Array(this.maxStringLength));
  }
  /**
     * Returns the internal of name of the super class (see
     * {@link Type#getInternalName() getInternalName}). For interfaces, the
     * super class is {@link Object}.
     *
     * @return the internal name of super class, or <tt>null</tt> for
     * {@link Object} class.
     * @see ClassVisitor#visit(int, int, String, String, String, String[])
     */
  getSuperName() {
    return this.readClass(this.header + 4, new Array(this.maxStringLength));
  }
  /**
     * Returns the internal names of the class's interfaces (see
     * {@link Type#getInternalName() getInternalName}).
     *
     * @return the array of internal names for all implemented interfaces or
     * <tt>null</tt>.
     * @see ClassVisitor#visit(int, int, String, String, String, String[])
     */
  getInterfaces() {
    let index = this.header + 6;
    const n = this.readUnsignedShort(index);
    const interfaces = new Array(n);
    if (n > 0) {
      const buf = new Array(this.maxStringLength);
      for (let i = 0; i < n; ++i) {
        index += 2;
        interfaces[i] = this.readClass(index, buf);
      }
    }
    return interfaces;
  }
  /**
     * Makes the given visitor visit the Java class of this {@link ClassReader}.
     * This class is the one specified in the constructor (see
     * {@link #ClassReader(byte[]) ClassReader}).
     *
     * @param classVisitor the visitor that must visit this class.
     * @param attrs        prototypes of the attributes that must be parsed during the
     * visit of the class. Any attribute whose type is not equal to
     * the type of one the prototypes will not be parsed: its byte
     * array value will be passed unchanged to the ClassWriter.
     * <i>This may corrupt it if this value contains references to
     * the constant pool, or has syntactic or semantic links with a
     * class element that has been transformed by a class adapter
     * between the reader and the writer</i>.
     * @param flags        option flags that can be used to modify the default behavior
     * of this class. See {@link #SKIP_DEBUG}, {@link #EXPAND_FRAMES}
     * , {@link #SKIP_FRAMES}, {@link #SKIP_CODE}.
     */
  accept(classVisitor, attrs = [], flags = 0) {
    let u = this.header;
    const c = new Array(this.maxStringLength);
    const context = new Context(attrs, flags, c);
    let access = this.readUnsignedShort(u);
    const name = this.readClass(u + 2, c);
    const superClass = this.readClass(u + 4, c);
    const interfaces = new Array(this.readUnsignedShort(u + 6));
    u += 8;
    for (let i = 0; i < interfaces.length; ++i) {
      interfaces[i] = this.readClass(u, c);
      u += 2;
    }
    let signature = null;
    let sourceFile = null;
    let sourceDebug = null;
    let enclosingOwner = null;
    let enclosingName = null;
    let enclosingDesc = null;
    let anns = 0;
    let ianns = 0;
    let tanns = 0;
    let itanns = 0;
    let innerClasses = 0;
    let attributes = null;
    u = this.getAttributes();
    for (let i = this.readUnsignedShort(u); i > 0; --i) {
      const attrName = this.readUTF8(u + 2, c);
      if (attrName === "SourceFile") {
        sourceFile = this.readUTF8(u + 8, c);
      } else if (attrName === "InnerClasses") {
        innerClasses = u + 8;
      } else if (attrName === "EnclosingMethod") {
        enclosingOwner = this.readClass(u + 8, c);
        const item = this.readUnsignedShort(u + 10);
        if (item !== 0) {
          enclosingName = this.readUTF8(this.items[item], c);
          enclosingDesc = this.readUTF8(this.items[item] + 2, c);
        }
      } else if (_ClassReader.SIGNATURES && attrName === "Signature") {
        signature = this.readUTF8(u + 8, c);
      } else if (_ClassReader.ANNOTATIONS && attrName === "RuntimeVisibleAnnotations") {
        anns = u + 8;
      } else if (_ClassReader.ANNOTATIONS && attrName === "RuntimeVisibleTypeAnnotations") {
        tanns = u + 8;
      } else if (attrName === "Deprecated") {
        access |= 131072 /* ACC_DEPRECATED */;
      } else if (attrName === "Synthetic") {
        access |= 4096 /* ACC_SYNTHETIC */ | ClassWriter.ACC_SYNTHETIC_ATTRIBUTE;
      } else if (attrName === "SourceDebugExtension") {
        const len = this.readInt(u + 4);
        sourceDebug = this.readUTF(u + 8, len, new Array(len));
      } else if (_ClassReader.ANNOTATIONS && attrName === "RuntimeInvisibleAnnotations") {
        ianns = u + 8;
      } else if (_ClassReader.ANNOTATIONS && attrName === "RuntimeInvisibleTypeAnnotations") {
        itanns = u + 8;
      } else if (attrName === "BootstrapMethods") {
        const bootstrapMethods = new Array(this.readUnsignedShort(u + 8));
        for (let j = 0, v = u + 10; j < bootstrapMethods.length; j++) {
          bootstrapMethods[j] = v;
          v += 2 + this.readUnsignedShort(v + 2) << 1;
        }
        context.bootstrapMethods = bootstrapMethods;
      } else {
        const attr = this.readAttribute(attrs, attrName, u + 8, this.readInt(u + 4), c, -1, null);
        if (attr != null) {
          attr.next = attributes;
          attributes = attr;
        }
      }
      u += 6 + this.readInt(u + 4);
    }
    classVisitor.visit(this.readInt(this.items[1] - 7), access, name, signature, superClass, interfaces);
    if ((flags & _ClassReader.SKIP_DEBUG) === 0 && (sourceFile != null || sourceDebug != null)) {
      classVisitor.visitSource(sourceFile, sourceDebug);
    }
    if (enclosingOwner != null) {
      classVisitor.visitOuterClass(enclosingOwner, enclosingName, enclosingDesc);
    }
    if (_ClassReader.ANNOTATIONS && anns !== 0) {
      for (let i = this.readUnsignedShort(anns), v = anns + 2; i > 0; --i) {
        v = this.readAnnotationValues(v + 2, c, true, classVisitor.visitAnnotation(this.readUTF8(v, c), true));
      }
    }
    if (_ClassReader.ANNOTATIONS && ianns !== 0) {
      for (let i = this.readUnsignedShort(ianns), v = ianns + 2; i > 0; --i) {
        v = this.readAnnotationValues(v + 2, c, true, classVisitor.visitAnnotation(this.readUTF8(v, c), false));
      }
    }
    if (_ClassReader.ANNOTATIONS && tanns !== 0) {
      for (let i = this.readUnsignedShort(tanns), v = tanns + 2; i > 0; --i) {
        v = this.readAnnotationTarget(context, v);
        v = this.readAnnotationValues(v + 2, c, true, classVisitor.visitTypeAnnotation(context.typeRef, context.typePath, this.readUTF8(v, c), true));
      }
    }
    if (_ClassReader.ANNOTATIONS && itanns !== 0) {
      for (let i = this.readUnsignedShort(itanns), v = itanns + 2; i > 0; --i) {
        v = this.readAnnotationTarget(context, v);
        v = this.readAnnotationValues(v + 2, c, true, classVisitor.visitTypeAnnotation(context.typeRef, context.typePath, this.readUTF8(v, c), false));
      }
    }
    while (attributes != null) {
      const attr = attributes.next;
      attributes.next = null;
      classVisitor.visitAttribute(attributes);
      attributes = attr;
    }
    if (innerClasses !== 0) {
      let v = innerClasses + 2;
      for (let i = this.readUnsignedShort(innerClasses); i > 0; --i) {
        classVisitor.visitInnerClass(this.readClass(v, c), this.readClass(v + 2, c), this.readUTF8(v + 4, c), this.readUnsignedShort(v + 6));
        v += 8;
      }
    }
    u = this.header + 10 + 2 * interfaces.length;
    for (let i = this.readUnsignedShort(u - 2); i > 0; --i) {
      u = this.readField(classVisitor, context, u);
    }
    u += 2;
    for (let i = this.readUnsignedShort(u - 2); i > 0; --i) {
      u = this.readMethod(classVisitor, context, u);
    }
    classVisitor.visitEnd();
  }
  /**
     * Reads a field and makes the given visitor visit it.
     *
     * @param classVisitor the visitor that must visit the field.
     * @param context      information about the class being parsed.
     * @param u            the start offset of the field in the class file.
     * @return the offset of the first byte following the field in the class.
     */
  readField(classVisitor, context, u) {
    const c = context.buffer;
    let access = this.readUnsignedShort(u);
    const name = this.readUTF8(u + 2, c);
    const desc = this.readUTF8(u + 4, c);
    u += 6;
    let signature = null;
    let anns = 0;
    let ianns = 0;
    let tanns = 0;
    let itanns = 0;
    let value = null;
    let attributes = null;
    for (let i = this.readUnsignedShort(u); i > 0; --i) {
      const attrName = this.readUTF8(u + 2, c);
      if (attrName === "ConstantValue") {
        const item = this.readUnsignedShort(u + 8);
        value = item === 0 ? null : this.readConst(item, c);
      } else if (_ClassReader.SIGNATURES && attrName === "Signature") {
        signature = this.readUTF8(u + 8, c);
      } else if (attrName === "Deprecated") {
        access |= 131072 /* ACC_DEPRECATED */;
      } else if (attrName === "Synthetic") {
        access |= 4096 /* ACC_SYNTHETIC */ | ClassWriter.ACC_SYNTHETIC_ATTRIBUTE;
      } else if (_ClassReader.ANNOTATIONS && attrName === "RuntimeVisibleAnnotations") {
        anns = u + 8;
      } else if (_ClassReader.ANNOTATIONS && attrName === "RuntimeVisibleTypeAnnotations") {
        tanns = u + 8;
      } else if (_ClassReader.ANNOTATIONS && attrName === "RuntimeInvisibleAnnotations") {
        ianns = u + 8;
      } else if (_ClassReader.ANNOTATIONS && attrName === "RuntimeInvisibleTypeAnnotations") {
        itanns = u + 8;
      } else {
        const attr = this.readAttribute(context.attrs, attrName, u + 8, this.readInt(u + 4), c, -1, null);
        if (attr != null) {
          attr.next = attributes;
          attributes = attr;
        }
      }
      u += 6 + this.readInt(u + 4);
    }
    u += 2;
    assert(name);
    const fv = classVisitor.visitField(access, name, desc, signature, value);
    if (fv == null) {
      return u;
    }
    if (_ClassReader.ANNOTATIONS && anns !== 0) {
      for (let i = this.readUnsignedShort(anns), v = anns + 2; i > 0; --i) {
        v = this.readAnnotationValues(v + 2, c, true, fv.visitAnnotation(this.readUTF8(v, c), true));
      }
    }
    if (_ClassReader.ANNOTATIONS && ianns !== 0) {
      for (let i = this.readUnsignedShort(ianns), v = ianns + 2; i > 0; --i) {
        v = this.readAnnotationValues(v + 2, c, true, fv.visitAnnotation(this.readUTF8(v, c), false));
      }
    }
    if (_ClassReader.ANNOTATIONS && tanns !== 0) {
      for (let i = this.readUnsignedShort(tanns), v = tanns + 2; i > 0; --i) {
        v = this.readAnnotationTarget(context, v);
        v = this.readAnnotationValues(v + 2, c, true, fv.visitTypeAnnotation(context.typeRef, context.typePath, this.readUTF8(v, c), true));
      }
    }
    if (_ClassReader.ANNOTATIONS && itanns !== 0) {
      for (let i = this.readUnsignedShort(itanns), v = itanns + 2; i > 0; --i) {
        v = this.readAnnotationTarget(context, v);
        v = this.readAnnotationValues(v + 2, c, true, fv.visitTypeAnnotation(context.typeRef, context.typePath, this.readUTF8(v, c), false));
      }
    }
    while (attributes != null) {
      const attr = attributes.next;
      attributes.next = null;
      fv.visitAttribute(attributes);
      attributes = attr;
    }
    fv.visitEnd();
    return u;
  }
  /**
     * Reads a method and makes the given visitor visit it.
     *
     * @param classVisitor the visitor that must visit the method.
     * @param context      information about the class being parsed.
     * @param u            the start offset of the method in the class file.
     * @return the offset of the first byte following the method in the class.
     */
  readMethod(classVisitor, context, u) {
    const c = context.buffer;
    context.access = this.readUnsignedShort(u);
    context.name = this.readUTF8(u + 2, c);
    context.desc = this.readUTF8(u + 4, c);
    u += 6;
    let code = 0;
    let exception = 0;
    let exceptions = null;
    let signature = null;
    let methodParameters = 0;
    let anns = 0;
    let ianns = 0;
    let tanns = 0;
    let itanns = 0;
    let dann = 0;
    let mpanns = 0;
    let impanns = 0;
    const firstAttribute = u;
    let attributes = null;
    for (let i = this.readUnsignedShort(u); i > 0; --i) {
      const attrName = this.readUTF8(u + 2, c);
      if (attrName === "Code") {
        if ((context.flags & _ClassReader.SKIP_CODE) === 0) {
          code = u + 8;
        }
      } else if (attrName === "Exceptions") {
        exceptions = new Array(this.readUnsignedShort(u + 8));
        exception = u + 10;
        for (let j = 0; j < exceptions.length; ++j) {
          exceptions[j] = this.readClass(exception, c);
          exception += 2;
        }
      } else if (_ClassReader.SIGNATURES && attrName === "Signature") {
        signature = this.readUTF8(u + 8, c);
      } else if (attrName === "Deprecated") {
        context.access |= 131072 /* ACC_DEPRECATED */;
      } else if (_ClassReader.ANNOTATIONS && attrName === "RuntimeVisibleAnnotations") {
        anns = u + 8;
      } else if (_ClassReader.ANNOTATIONS && attrName === "RuntimeVisibleTypeAnnotations") {
        tanns = u + 8;
      } else if (_ClassReader.ANNOTATIONS && attrName === "AnnotationDefault") {
        dann = u + 8;
      } else if (attrName === "Synthetic") {
        context.access |= 4096 /* ACC_SYNTHETIC */ | ClassWriter.ACC_SYNTHETIC_ATTRIBUTE;
      } else if (_ClassReader.ANNOTATIONS && attrName === "RuntimeInvisibleAnnotations") {
        ianns = u + 8;
      } else if (_ClassReader.ANNOTATIONS && attrName === "RuntimeInvisibleTypeAnnotations") {
        itanns = u + 8;
      } else if (_ClassReader.ANNOTATIONS && attrName === "RuntimeVisibleParameterAnnotations") {
        mpanns = u + 8;
      } else if (_ClassReader.ANNOTATIONS && attrName === "RuntimeInvisibleParameterAnnotations") {
        impanns = u + 8;
      } else if (attrName === "MethodParameters") {
        methodParameters = u + 8;
      } else {
        const attr = this.readAttribute(context.attrs, attrName, u + 8, this.readInt(u + 4), c, -1, null);
        if (attr != null) {
          attr.next = attributes;
          attributes = attr;
        }
      }
      u += 6 + this.readInt(u + 4);
    }
    u += 2;
    const mv = classVisitor.visitMethod(context.access, context.name, context.desc, signature, exceptions);
    if (mv == null) {
      return u;
    }
    if (_ClassReader.WRITER && (mv != null && mv instanceof MethodWriter)) {
      const mw = mv;
      if (mw.cw.cr === this && signature === mw.signature) {
        let sameExceptions = false;
        if (exceptions == null) {
          sameExceptions = mw.exceptionCount === 0;
        } else if (exceptions.length === mw.exceptionCount) {
          sameExceptions = true;
          for (let j = exceptions.length - 1; j >= 0; --j) {
            exception -= 2;
            if (mw.exceptions?.[j] !== this.readUnsignedShort(exception)) {
              sameExceptions = false;
              break;
            }
          }
        }
        if (sameExceptions) {
          mw.classReaderOffset = firstAttribute;
          mw.classReaderLength = u - firstAttribute;
          return u;
        }
      }
    }
    if (methodParameters !== 0) {
      for (let i = this.buf[methodParameters] & 255, v = methodParameters + 1; i > 0; --i, v = v + 4) {
        mv.visitParameter(this.readUTF8(v, c), this.readUnsignedShort(v + 2));
      }
    }
    if (_ClassReader.ANNOTATIONS && dann !== 0) {
      const dv = mv.visitAnnotationDefault();
      this.readAnnotationValue(dann, c, null, dv);
      if (dv != null) {
        dv.visitEnd();
      }
    }
    if (_ClassReader.ANNOTATIONS && anns !== 0) {
      for (let i = this.readUnsignedShort(anns), v = anns + 2; i > 0; --i) {
        v = this.readAnnotationValues(v + 2, c, true, mv.visitAnnotation(this.readUTF8(v, c), true));
      }
    }
    if (_ClassReader.ANNOTATIONS && ianns !== 0) {
      for (let i = this.readUnsignedShort(ianns), v = ianns + 2; i > 0; --i) {
        v = this.readAnnotationValues(v + 2, c, true, mv.visitAnnotation(this.readUTF8(v, c), false));
      }
    }
    if (_ClassReader.ANNOTATIONS && tanns !== 0) {
      for (let i = this.readUnsignedShort(tanns), v = tanns + 2; i > 0; --i) {
        v = this.readAnnotationTarget(context, v);
        v = this.readAnnotationValues(v + 2, c, true, mv.visitTypeAnnotation(context.typeRef, context.typePath, this.readUTF8(v, c), true));
      }
    }
    if (_ClassReader.ANNOTATIONS && itanns !== 0) {
      for (let i = this.readUnsignedShort(itanns), v = itanns + 2; i > 0; --i) {
        v = this.readAnnotationTarget(context, v);
        v = this.readAnnotationValues(v + 2, c, true, mv.visitTypeAnnotation(context.typeRef, context.typePath, this.readUTF8(v, c), false));
      }
    }
    if (_ClassReader.ANNOTATIONS && mpanns !== 0) {
      this.readParameterAnnotations(mv, context, mpanns, true);
    }
    if (_ClassReader.ANNOTATIONS && impanns !== 0) {
      this.readParameterAnnotations(mv, context, impanns, false);
    }
    while (attributes != null) {
      const attr = attributes.next;
      attributes.next = null;
      mv.visitAttribute(attributes);
      attributes = attr;
    }
    if (code !== 0) {
      mv.visitCode();
      this.readCode(mv, context, code);
    }
    mv.visitEnd();
    return u;
  }
  /**
     * Reads the bytecode of a method and makes the given visitor visit it.
     *
     * @param mv      the visitor that must visit the method's code.
     * @param context information about the class being parsed.
     * @param u       the start offset of the code attribute in the class file.
     */
  readCode(mv, context, u) {
    const b = this.buf;
    const c = context.buffer;
    const maxStack = this.readUnsignedShort(u);
    const maxLocals = this.readUnsignedShort(u + 2);
    const codeLength = this.readInt(u + 4);
    u += 8;
    const codeStart = u;
    const codeEnd = u + codeLength;
    const labels = context.labels = new Array(codeLength + 2);
    this.readLabel(codeLength + 1, labels);
    while (u < codeEnd) {
      const offset = u - codeStart;
      let opcode = b[u] & 255;
      switch (ClassWriter.TYPE[opcode]) {
        case ClassWriter.NOARG_INSN:
        case ClassWriter.IMPLVAR_INSN:
          u += 1;
          break;
        case ClassWriter.LABEL_INSN:
          this.readLabel(offset + this.readShort(u + 1), labels);
          u += 3;
          break;
        case ClassWriter.ASM_LABEL_INSN:
          this.readLabel(offset + this.readUnsignedShort(u + 1), labels);
          u += 3;
          break;
        case ClassWriter.LABELW_INSN:
          this.readLabel(offset + this.readInt(u + 1), labels);
          u += 5;
          break;
        case ClassWriter.WIDE_INSN:
          opcode = b[u + 1] & 255;
          if (opcode === 132 /* IINC */) {
            u += 6;
          } else {
            u += 4;
          }
          break;
        case ClassWriter.TABL_INSN:
          u = u + 4 - (offset & 3);
          this.readLabel(offset + this.readInt(u), labels);
          for (let i = this.readInt(u + 8) - this.readInt(u + 4) + 1; i > 0; --i) {
            this.readLabel(offset + this.readInt(u + 12), labels);
            u += 4;
          }
          u += 12;
          break;
        case ClassWriter.LOOK_INSN:
          u = u + 4 - (offset & 3);
          this.readLabel(offset + this.readInt(u), labels);
          for (let i = this.readInt(u + 4); i > 0; --i) {
            this.readLabel(offset + this.readInt(u + 12), labels);
            u += 8;
          }
          u += 8;
          break;
        case ClassWriter.VAR_INSN:
        case ClassWriter.SBYTE_INSN:
        case ClassWriter.LDC_INSN:
          u += 2;
          break;
        case ClassWriter.SHORT_INSN:
        case ClassWriter.LDCW_INSN:
        case ClassWriter.FIELDORMETH_INSN:
        case ClassWriter.TYPE_INSN:
        case ClassWriter.IINC_INSN:
          u += 3;
          break;
        case ClassWriter.ITFMETH_INSN:
        case ClassWriter.INDYMETH_INSN:
          u += 5;
          break;
        default:
          u += 4;
          break;
      }
    }
    for (let i = this.readUnsignedShort(u); i > 0; --i) {
      const start = this.readLabel(this.readUnsignedShort(u + 2), labels);
      const end = this.readLabel(this.readUnsignedShort(u + 4), labels);
      const handler = this.readLabel(this.readUnsignedShort(u + 6), labels);
      const type = this.readUTF8(this.items[this.readUnsignedShort(u + 8)], c);
      mv.visitTryCatchBlock(start, end, handler, type);
      u += 8;
    }
    u += 2;
    let tanns = null;
    let itanns = null;
    let tann = 0;
    let itann = 0;
    let ntoff = -1;
    let nitoff = -1;
    let varTable = 0;
    let varTypeTable = 0;
    let zip = true;
    const unzip = (context.flags & _ClassReader.EXPAND_FRAMES) !== 0;
    let stackMap = 0;
    let stackMapSize = 0;
    let frameCount = 0;
    let frame = null;
    let attributes = null;
    for (let i = this.readUnsignedShort(u); i > 0; --i) {
      const attrName = this.readUTF8(u + 2, c);
      if (attrName === "LocalVariableTable") {
        if ((context.flags & _ClassReader.SKIP_DEBUG) === 0) {
          varTable = u + 8;
          for (let j = this.readUnsignedShort(u + 8), v = u; j > 0; --j) {
            let label = this.readUnsignedShort(v + 10);
            if (labels[label] == null) {
              this.readLabel(label, labels).status |= Label.DEBUG;
            }
            label += this.readUnsignedShort(v + 12);
            if (labels[label] == null) {
              this.readLabel(label, labels).status |= Label.DEBUG;
            }
            v += 10;
          }
        }
      } else if (attrName === "LocalVariableTypeTable") {
        varTypeTable = u + 8;
      } else if (attrName === "LineNumberTable") {
        if ((context.flags & _ClassReader.SKIP_DEBUG) === 0) {
          for (let j = this.readUnsignedShort(u + 8), v = u; j > 0; --j) {
            const label = this.readUnsignedShort(v + 10);
            if (labels[label] == null) {
              this.readLabel(label, labels).status |= Label.DEBUG;
            }
            let l = labels[label];
            while (l.line > 0) {
              if (l.next == null) {
                l.next = new Label();
              }
              l = l.next;
            }
            l.line = this.readUnsignedShort(v + 12);
            v += 4;
          }
        }
      } else if (_ClassReader.ANNOTATIONS && attrName === "RuntimeVisibleTypeAnnotations") {
        tanns = this.readTypeAnnotations(mv, context, u + 8, true);
        ntoff = tanns.length === 0 || this.readByte(tanns[0]) < 67 ? -1 : this.readUnsignedShort(tanns[0] + 1);
      } else if (_ClassReader.ANNOTATIONS && attrName === "RuntimeInvisibleTypeAnnotations") {
        itanns = this.readTypeAnnotations(mv, context, u + 8, false);
        nitoff = itanns.length === 0 || this.readByte(itanns[0]) < 67 ? -1 : this.readUnsignedShort(itanns[0] + 1);
      } else if (_ClassReader.FRAMES && attrName === "StackMapTable") {
        if ((context.flags & _ClassReader.SKIP_FRAMES) === 0) {
          stackMap = u + 10;
          stackMapSize = this.readInt(u + 4);
          frameCount = this.readUnsignedShort(u + 8);
        }
      } else if (_ClassReader.FRAMES && attrName === "StackMap") {
        if ((context.flags & _ClassReader.SKIP_FRAMES) === 0) {
          zip = false;
          stackMap = u + 10;
          stackMapSize = this.readInt(u + 4);
          frameCount = this.readUnsignedShort(u + 8);
        }
      } else {
        for (let j = 0; j < context.attrs.length; ++j) {
          if (context.attrs[j].type === attrName) {
            const attr = context.attrs[j].read(this, u + 8, this.readInt(u + 4), c, codeStart - 8, labels);
            if (attr != null) {
              attr.next = attributes;
              attributes = attr;
            }
          }
        }
      }
      u += 6 + this.readInt(u + 4);
    }
    u += 2;
    if (_ClassReader.FRAMES && stackMap !== 0) {
      frame = context;
      frame.offset = -1;
      frame.mode = 0;
      frame.localCount = 0;
      frame.localDiff = 0;
      frame.stackCount = 0;
      frame.local = new Array(maxLocals);
      frame.stack = new Array(maxStack);
      if (unzip) {
        this.getImplicitFrame(context);
      }
      for (let i = stackMap; i < stackMap + stackMapSize - 2; ++i) {
        if (b[i] === 8) {
          const v = this.readUnsignedShort(i + 1);
          if (v >= 0 && v < codeLength) {
            if ((b[codeStart + v] & 255) === 187 /* NEW */) {
              this.readLabel(v, labels);
            }
          }
        }
      }
    }
    if ((context.flags & _ClassReader.EXPAND_ASM_INSNS) !== 0) {
      mv.visitFrame(-1 /* F_NEW */, maxLocals, null, 0, null);
    }
    const opcodeDelta = (context.flags & _ClassReader.EXPAND_ASM_INSNS) === 0 ? -33 : 0;
    u = codeStart;
    while (u < codeEnd) {
      const offset = u - codeStart;
      const l = labels[offset];
      if (l != null) {
        let next = l.next;
        l.next = null;
        mv.visitLabel(l);
        if ((context.flags & _ClassReader.SKIP_DEBUG) === 0 && l.line > 0) {
          mv.visitLineNumber(l.line, l);
          while (next != null) {
            mv.visitLineNumber(next.line, l);
            next = next.next;
          }
        }
      }
      while (_ClassReader.FRAMES && frame != null && (frame.offset === offset || frame.offset === -1)) {
        if (frame.offset !== -1) {
          if (!zip || unzip) {
            mv.visitFrame(-1 /* F_NEW */, frame.localCount, frame.local, frame.stackCount, frame.stack);
          } else {
            mv.visitFrame(frame.mode, frame.localDiff, frame.local, frame.stackCount, frame.stack);
          }
        }
        if (frameCount > 0) {
          stackMap = this.readFrame(stackMap, zip, unzip, frame);
          --frameCount;
        } else {
          frame = null;
        }
      }
      let opcode = b[u] & 255;
      switch (ClassWriter.TYPE[opcode]) {
        case ClassWriter.NOARG_INSN:
          mv.visitInsn(opcode);
          u += 1;
          break;
        case ClassWriter.IMPLVAR_INSN:
          if (opcode > 54 /* ISTORE */) {
            opcode -= 59;
            mv.visitVarInsn(54 /* ISTORE */ + (opcode >> 2), opcode & 3);
          } else {
            opcode -= 26;
            mv.visitVarInsn(21 /* ILOAD */ + (opcode >> 2), opcode & 3);
          }
          u += 1;
          break;
        case ClassWriter.LABEL_INSN:
          mv.visitJumpInsn(opcode, labels[offset + this.readShort(u + 1)]);
          u += 3;
          break;
        case ClassWriter.LABELW_INSN:
          mv.visitJumpInsn(opcode + opcodeDelta, labels[offset + this.readInt(u + 1)]);
          u += 5;
          break;
        case ClassWriter.ASM_LABEL_INSN: {
          opcode = opcode < 218 ? opcode - 49 : opcode - 20;
          const target = labels[offset + this.readUnsignedShort(u + 1)];
          if (opcode === 167 /* GOTO */ || opcode === 168 /* JSR */) {
            mv.visitJumpInsn(opcode + 33, target);
          } else {
            opcode = opcode <= 166 ? (opcode + 1 ^ 1) - 1 : opcode ^ 1;
            const endif = new Label();
            mv.visitJumpInsn(opcode, endif);
            mv.visitJumpInsn(200, target);
            mv.visitLabel(endif);
            if (_ClassReader.FRAMES && stackMap !== 0 && (frame == null || frame.offset !== offset + 3)) {
              mv.visitFrame(ClassWriter.F_INSERT, 0, null, 0, null);
            }
          }
          u += 3;
          break;
        }
        case ClassWriter.WIDE_INSN:
          opcode = b[u + 1] & 255;
          if (opcode === 132 /* IINC */) {
            mv.visitIincInsn(this.readUnsignedShort(u + 2), this.readShort(u + 4));
            u += 6;
          } else {
            mv.visitVarInsn(opcode, this.readUnsignedShort(u + 2));
            u += 4;
          }
          break;
        case ClassWriter.TABL_INSN: {
          u = u + 4 - (offset & 3);
          const label = offset + this.readInt(u);
          const min = this.readInt(u + 4);
          const max = this.readInt(u + 8);
          const table = new Array(max - min + 1);
          u += 12;
          for (let i = 0; i < table.length; ++i) {
            table[i] = labels[offset + this.readInt(u)];
            u += 4;
          }
          mv.visitTableSwitchInsn(min, max, labels[label], ...table);
          break;
        }
        case ClassWriter.LOOK_INSN: {
          u = u + 4 - (offset & 3);
          const label = offset + this.readInt(u);
          const len = this.readInt(u + 4);
          const keys = new Array(len);
          const values = new Array(len);
          u += 8;
          for (let i = 0; i < len; ++i) {
            keys[i] = this.readInt(u);
            values[i] = labels[offset + this.readInt(u + 4)];
            u += 8;
          }
          mv.visitLookupSwitchInsn(labels[label], keys, values);
          break;
        }
        case ClassWriter.VAR_INSN:
          mv.visitVarInsn(opcode, b[u + 1] & 255);
          u += 2;
          break;
        case ClassWriter.SBYTE_INSN:
          mv.visitIntInsn(opcode, b[u + 1]);
          u += 2;
          break;
        case ClassWriter.SHORT_INSN:
          mv.visitIntInsn(opcode, this.readShort(u + 1));
          u += 3;
          break;
        case ClassWriter.LDC_INSN:
          mv.visitLdcInsn(this.readConst(b[u + 1] & 255, c));
          u += 2;
          break;
        case ClassWriter.LDCW_INSN:
          mv.visitLdcInsn(this.readConst(this.readUnsignedShort(u + 1), c));
          u += 3;
          break;
        case ClassWriter.FIELDORMETH_INSN:
        case ClassWriter.ITFMETH_INSN: {
          let cpIndex = this.items[this.readUnsignedShort(u + 1)];
          const itf = b[cpIndex - 1] === ClassWriter.IMETH;
          const iowner = this.readClass(cpIndex, c);
          cpIndex = this.items[this.readUnsignedShort(cpIndex + 2)];
          const iname = this.readUTF8(cpIndex, c);
          const idesc = this.readUTF8(cpIndex + 2, c);
          if (opcode < 182 /* INVOKEVIRTUAL */) {
            mv.visitFieldInsn(opcode, iowner, iname, idesc);
          } else {
            mv.visitMethodInsn(opcode, iowner, iname, idesc, itf);
          }
          if (opcode === 185 /* INVOKEINTERFACE */) {
            u += 5;
          } else {
            u += 3;
          }
          break;
        }
        case ClassWriter.INDYMETH_INSN: {
          let cpIndex = this.items[this.readUnsignedShort(u + 1)];
          let bsmIndex = context.bootstrapMethods[this.readUnsignedShort(cpIndex)];
          const bsm = this.readConst(this.readUnsignedShort(bsmIndex), c);
          const bsmArgCount = this.readUnsignedShort(bsmIndex + 2);
          const bsmArgs = new Array(bsmArgCount);
          bsmIndex += 4;
          for (let i = 0; i < bsmArgCount; i++) {
            bsmArgs[i] = this.readConst(this.readUnsignedShort(bsmIndex), c);
            bsmIndex += 2;
          }
          cpIndex = this.items[this.readUnsignedShort(cpIndex + 2)];
          const iname = this.readUTF8(cpIndex, c);
          const idesc = this.readUTF8(cpIndex + 2, c);
          mv.visitInvokeDynamicInsn(iname, idesc, bsm, ...bsmArgs);
          u += 5;
          break;
        }
        case ClassWriter.TYPE_INSN:
          mv.visitTypeInsn(opcode, this.readClass(u + 1, c));
          u += 3;
          break;
        case ClassWriter.IINC_INSN:
          mv.visitIincInsn(b[u + 1] & 255, b[u + 2]);
          u += 3;
          break;
        default:
          mv.visitMultiANewArrayInsn(this.readClass(u + 1, c), b[u + 3] & 255);
          u += 4;
          break;
      }
      while (tanns != null && tann < tanns.length && ntoff <= offset) {
        if (ntoff === offset) {
          const v = this.readAnnotationTarget(context, tanns[tann]);
          this.readAnnotationValues(v + 2, c, true, mv.visitInsnAnnotation(context.typeRef, context.typePath, this.readUTF8(v, c), true));
        }
        ntoff = ++tann >= tanns.length || this.readByte(tanns[tann]) < 67 ? -1 : this.readUnsignedShort(tanns[tann] + 1);
      }
      while (itanns != null && itann < itanns.length && nitoff <= offset) {
        if (nitoff === offset) {
          const v = this.readAnnotationTarget(context, itanns[itann]);
          this.readAnnotationValues(v + 2, c, true, mv.visitInsnAnnotation(context.typeRef, context.typePath, this.readUTF8(v, c), false));
        }
        nitoff = ++itann >= itanns.length || this.readByte(itanns[itann]) < 67 ? -1 : this.readUnsignedShort(itanns[itann] + 1);
      }
    }
    if (labels[codeLength] != null) {
      mv.visitLabel(labels[codeLength]);
    }
    if ((context.flags & _ClassReader.SKIP_DEBUG) === 0 && varTable !== 0) {
      let typeTable = null;
      if (varTypeTable !== 0) {
        u = varTypeTable + 2;
        typeTable = new Array(this.readUnsignedShort(varTypeTable) * 3);
        for (let i = typeTable.length; i > 0; ) {
          typeTable[--i] = u + 6;
          typeTable[--i] = this.readUnsignedShort(u + 8);
          typeTable[--i] = this.readUnsignedShort(u);
          u += 10;
        }
      }
      u = varTable + 2;
      for (let i = this.readUnsignedShort(varTable); i > 0; --i) {
        const start = this.readUnsignedShort(u);
        const length = this.readUnsignedShort(u + 2);
        const index = this.readUnsignedShort(u + 8);
        let vsignature = null;
        if (typeTable != null) {
          for (let j = 0; j < typeTable.length; j += 3) {
            if (typeTable[j] === start && typeTable[j + 1] === index) {
              vsignature = this.readUTF8(typeTable[j + 2], c);
              break;
            }
          }
        }
        mv.visitLocalVariable(this.readUTF8(u + 4, c), this.readUTF8(u + 6, c), vsignature, labels[start], labels[start + length], index);
        u += 10;
      }
    }
    if (tanns != null) {
      for (let i = 0; i < tanns.length; ++i) {
        if (this.readByte(tanns[i]) >> 1 === 64 >> 1) {
          let v = this.readAnnotationTarget(context, tanns[i]);
          v = this.readAnnotationValues(v + 2, c, true, mv.visitLocalVariableAnnotation(context.typeRef, context.typePath, context.start, context.end, context.index, this.readUTF8(v, c), true));
        }
      }
    }
    if (itanns != null) {
      for (let i = 0; i < itanns.length; ++i) {
        if (this.readByte(itanns[i]) >> 1 === 64 >> 1) {
          let v = this.readAnnotationTarget(context, itanns[i]);
          v = this.readAnnotationValues(v + 2, c, true, mv.visitLocalVariableAnnotation(context.typeRef, context.typePath, context.start, context.end, context.index, this.readUTF8(v, c), false));
        }
      }
    }
    while (attributes != null) {
      const attr = attributes.next;
      attributes.next = null;
      mv.visitAttribute(attributes);
      attributes = attr;
    }
    mv.visitMaxs(maxStack, maxLocals);
  }
  /**
     * Parses a type annotation table to find the labels, and to visit the try
     * catch block annotations.
     *
     * @param u       the start offset of a type annotation table.
     * @param mv      the method visitor to be used to visit the try catch block
     * annotations.
     * @param context information about the class being parsed.
     * @param visible if the type annotation table to parse contains runtime visible
     * annotations.
     * @return the start offset of each type annotation in the parsed table.
     */
  readTypeAnnotations(mv, context, u, visible) {
    const c = context.buffer;
    const offsets = new Array(this.readUnsignedShort(u));
    u += 2;
    for (let i = 0; i < offsets.length; ++i) {
      offsets[i] = u;
      const target = this.readInt(u);
      switch (target >>> 24) {
        case 0:
        case 1:
        case 22:
          u += 2;
          break;
        case 19:
        case 20:
        case 21:
          u += 1;
          break;
        case 64:
        case 65:
          for (let j = this.readUnsignedShort(u + 1); j > 0; --j) {
            const start = this.readUnsignedShort(u + 3);
            const length = this.readUnsignedShort(u + 5);
            this.readLabel(start, context.labels);
            this.readLabel(start + length, context.labels);
            u += 6;
          }
          u += 3;
          break;
        case 71:
        case 72:
        case 73:
        case 74:
        case 75:
          u += 4;
          break;
        default:
          u += 3;
          break;
      }
      const pathLength = this.readByte(u);
      if (target >>> 24 === 66) {
        const path = pathLength === 0 ? null : new TypePath(this.buf, u);
        u += 1 + 2 * pathLength;
        u = this.readAnnotationValues(u + 2, c, true, mv.visitTryCatchAnnotation(target, path, this.readUTF8(u, c), visible));
      } else {
        u = this.readAnnotationValues(u + 3 + 2 * pathLength, c, true, null);
      }
    }
    return offsets;
  }
  /**
     * Parses the header of a type annotation to extract its target_type and
     * target_path (the result is stored in the given context), and returns the
     * start offset of the rest of the type_annotation structure (i.e. the
     * offset to the type_index field, which is followed by
     * num_element_value_pairs and then the name,value pairs).
     *
     * @param context information about the class being parsed. This is where the
     * extracted target_type and target_path must be stored.
     * @param u       the start offset of a type_annotation structure.
     * @return the start offset of the rest of the type_annotation structure.
     */
  readAnnotationTarget(context, u) {
    let target = this.readInt(u);
    switch (target >>> 24) {
      case 0:
      case 1:
      case 22:
        target &= -65536;
        u += 2;
        break;
      case 19:
      case 20:
      case 21:
        target &= -16777216;
        u += 1;
        break;
      case 64:
      case 65: {
        target &= -16777216;
        const n = this.readUnsignedShort(u + 1);
        context.start = new Array(n);
        context.end = new Array(n);
        context.index = new Array(n);
        u += 3;
        for (let i = 0; i < n; ++i) {
          const start = this.readUnsignedShort(u);
          const length = this.readUnsignedShort(u + 2);
          context.start[i] = this.readLabel(start, context.labels);
          context.end[i] = this.readLabel(start + length, context.labels);
          context.index[i] = this.readUnsignedShort(u + 4);
          u += 6;
        }
        break;
      }
      case 71:
      case 72:
      case 73:
      case 74:
      case 75:
        target &= -16776961;
        u += 4;
        break;
      default:
        target &= target >>> 24 < 67 ? -256 : -16777216;
        u += 3;
        break;
    }
    const pathLength = this.readByte(u);
    context.typeRef = target;
    context.typePath = pathLength === 0 ? null : new TypePath(this.buf, u);
    return u + 1 + 2 * pathLength;
  }
  /**
     * Reads parameter annotations and makes the given visitor visit them.
     *
     * @param mv      the visitor that must visit the annotations.
     * @param context information about the class being parsed.
     * @param v       start offset in {@link #b b} of the annotations to be read.
     * @param visible <tt>true</tt> if the annotations to be read are visible at
     * runtime.
     */
  readParameterAnnotations(mv, context, v, visible) {
    let i;
    const n = this.buf[v++] & 255;
    const synthetics = Type.getArgumentTypes(context.desc).length - n;
    let av = null;
    for (i = 0; i < synthetics; ++i) {
      av = mv.visitParameterAnnotation(i, "Ljava/lang/Synthetic;", false);
      if (av != null) {
        av.visitEnd();
      }
    }
    const c = context.buffer;
    for (; i < n + synthetics; ++i) {
      let j = this.readUnsignedShort(v);
      v += 2;
      for (; j > 0; --j) {
        av = mv.visitParameterAnnotation(i, this.readUTF8(v, c), visible);
        v = this.readAnnotationValues(v + 2, c, true, av);
      }
    }
  }
  /**
     * Reads the values of an annotation and makes the given visitor visit them.
     *
     * @param v     the start offset in {@link #b b} of the values to be read
     * (including the unsigned short that gives the number of
     * values).
     * @param buf   buffer to be used to call {@link #readUTF8 readUTF8},
     * {@link #readClass(int, int[]) readClass} or {@link #readConst
     * readConst}.
     * @param named if the annotation values are named or not.
     * @param av    the visitor that must visit the values.
     * @return the end offset of the annotation values.
     */
  readAnnotationValues(v, buf, named, av) {
    let i = this.readUnsignedShort(v);
    v += 2;
    if (named) {
      for (; i > 0; --i) {
        v = this.readAnnotationValue(v + 2, buf, this.readUTF8(v, buf), av);
      }
    } else {
      for (; i > 0; --i) {
        v = this.readAnnotationValue(v, buf, null, av);
      }
    }
    if (av != null) {
      av.visitEnd();
    }
    return v;
  }
  /**
     * Reads a value of an annotation and makes the given visitor visit it.
     *
     * @param v    the start offset in {@link #b b} of the value to be read
     * (<i>not including the value name constant pool index</i>).
     * @param buf  buffer to be used to call {@link #readUTF8 readUTF8},
     * {@link #readClass(int, int[]) readClass} or {@link #readConst
     * readConst}.
     * @param name the name of the value to be read.
     * @param av   the visitor that must visit the value.
     * @return the end offset of the annotation value.
     */
  readAnnotationValue(v, buf, name, av) {
    name = name ?? "";
    let i;
    if (av == null) {
      switch (this.buf[v] & 255) {
        case "e".charCodeAt(0):
          return v + 5;
        case "@".charCodeAt(0):
          return this.readAnnotationValues(v + 3, buf, true, null);
        case "[".charCodeAt(0):
          return this.readAnnotationValues(v + 1, buf, false, null);
        default:
          return v + 3;
      }
    }
    switch (this.buf[v++] & 255) {
      case "I".charCodeAt(0):
      case "J".charCodeAt(0):
      case "F".charCodeAt(0):
      case "D".charCodeAt(0):
        av.visit(name, this.readConst(this.readUnsignedShort(v), buf));
        v += 2;
        break;
      case "B".charCodeAt(0):
        av.visit(name, this.readInt(this.items[this.readUnsignedShort(v)]) | 0);
        v += 2;
        break;
      case "Z".charCodeAt(0):
        av.visit(name, this.readInt(this.items[this.readUnsignedShort(v)]) !== 0);
        v += 2;
        break;
      case "S".charCodeAt(0):
        av.visit(name, this.readInt(this.items[this.readUnsignedShort(v)]) | 0);
        v += 2;
        break;
      case "C".charCodeAt(0):
        av.visit(name, String.fromCharCode(this.readInt(this.items[this.readUnsignedShort(v)])));
        v += 2;
        break;
      case "s".charCodeAt(0):
        av.visit(name, this.readUTF8(v, buf));
        v += 2;
        break;
      case "e".charCodeAt(0):
        av.visitEnum(name, this.readUTF8(v, buf), this.readUTF8(v + 2, buf));
        v += 4;
        break;
      case "c".charCodeAt(0):
        av.visit(name, Type.getType(this.readUTF8(v, buf)));
        v += 2;
        break;
      case "@".charCodeAt(0):
        v = this.readAnnotationValues(v + 2, buf, true, av.visitAnnotation(name, this.readUTF8(v, buf)));
        break;
      case "[".charCodeAt(0):
        const size = this.readUnsignedShort(v);
        v += 2;
        if (size === 0) {
          return this.readAnnotationValues(v - 2, buf, false, av.visitArray(name));
        }
        switch (this.buf[v++] & 255) {
          case "B".charCodeAt(0):
            const bv = new Array(size);
            for (i = 0; i < size; i++) {
              bv[i] = this.readInt(this.items[this.readUnsignedShort(v)]) | 0;
              v += 3;
            }
            av.visit(name, bv);
            --v;
            break;
          case "Z".charCodeAt(0):
            const zv = new Array(size);
            for (i = 0; i < size; i++) {
              zv[i] = this.readInt(this.items[this.readUnsignedShort(v)]) !== 0;
              v += 3;
            }
            av.visit(name, zv);
            --v;
            break;
          case "S".charCodeAt(0):
            const sv = new Array(size);
            for (i = 0; i < size; i++) {
              sv[i] = this.readInt(this.items[this.readUnsignedShort(v)]) | 0;
              v += 3;
            }
            av.visit(name, sv);
            --v;
            break;
          case "C".charCodeAt(0):
            const cv = new Array(size);
            for (i = 0; i < size; i++) {
              cv[i] = String.fromCharCode(this.readInt(this.items[this.readUnsignedShort(v)]));
              v += 3;
            }
            av.visit(name, cv);
            --v;
            break;
          case "I".charCodeAt(0):
            const iv = new Array(size);
            for (i = 0; i < size; i++) {
              iv[i] = this.readInt(this.items[this.readUnsignedShort(v)]);
              v += 3;
            }
            av.visit(name, iv);
            --v;
            break;
          case "J".charCodeAt(0):
            const lv = new Array(size);
            for (i = 0; i < size; i++) {
              lv[i] = this.readLong(this.items[this.readUnsignedShort(v)]);
              v += 3;
            }
            av.visit(name, lv);
            --v;
            break;
          case "F".charCodeAt(0):
            const fv = new Array(size);
            for (i = 0; i < size; i++) {
              fv[i] = intBitsToFloat(this.readInt(this.items[this.readUnsignedShort(v)]));
              v += 3;
            }
            av.visit(name, fv);
            --v;
            break;
          case "D".charCodeAt(0):
            const dv = new Array(size);
            for (i = 0; i < size; i++) {
              dv[i] = longBitsToDouble(this.readLong(this.items[this.readUnsignedShort(v)]));
              v += 3;
            }
            av.visit(name, dv);
            --v;
            break;
          default:
            v = this.readAnnotationValues(v - 3, buf, false, av.visitArray(name));
        }
    }
    return v;
  }
  /**
     * Computes the implicit frame of the method currently being parsed (as
     * defined in the given {@link Context}) and stores it in the given context.
     *
     * @param frame information about the class being parsed.
     */
  getImplicitFrame(frame) {
    const desc = frame.desc;
    const locals = frame.local;
    let local = 0;
    if ((frame.access & 8 /* ACC_STATIC */) === 0) {
      if (frame.name === "<init>") {
        locals[local++] = 6 /* UNINITIALIZED_THIS */;
      } else {
        locals[local++] = this.readClass(this.header + 2, frame.buffer);
      }
    }
    let i = 1;
    loop:
      while (true) {
        const j = i;
        switch (desc.charAt(i++).charCodeAt(0)) {
          case "Z".charCodeAt(0):
          case "C".charCodeAt(0):
          case "B".charCodeAt(0):
          case "S".charCodeAt(0):
          case "I".charCodeAt(0):
            locals[local++] = 1 /* INTEGER */;
            break;
          case "F".charCodeAt(0):
            locals[local++] = 2 /* FLOAT */;
            break;
          case "J".charCodeAt(0):
            locals[local++] = 4 /* LONG */;
            break;
          case "D".charCodeAt(0):
            locals[local++] = 3 /* DOUBLE */;
            break;
          case "[".charCodeAt(0):
            while (desc.charAt(i) === "[") {
              ++i;
            }
            if (desc.charAt(i) === "L") {
              ++i;
              while (desc.charAt(i) !== ";") {
                ++i;
              }
            }
            locals[local++] = desc.substring(j, ++i);
            break;
          case "L".charCodeAt(0):
            while (desc.charAt(i) !== ";") {
              ++i;
            }
            locals[local++] = desc.substring(j + 1, i++);
            break;
          default:
            break loop;
        }
      }
    frame.localCount = local;
  }
  /**
     * Reads a stack map frame and stores the result in the given
     * {@link Context} object.
     *
     * @param stackMap the start offset of a stack map frame in the class file.
     * @param zip      if the stack map frame at stackMap is compressed or not.
     * @param unzip    if the stack map frame must be uncompressed.
     * @param frame    where the parsed stack map frame must be stored.
     * @return the offset of the first byte following the parsed frame.
     */
  readFrame(stackMap, zip, unzip, frame) {
    const c = frame.buffer;
    const labels = frame.labels;
    let tag;
    let delta;
    if (zip) {
      tag = this.buf[stackMap++] & 255;
    } else {
      tag = MethodWriter.FULL_FRAME;
      frame.offset = -1;
    }
    frame.localDiff = 0;
    if (tag < MethodWriter.SAME_LOCALS_1_STACK_ITEM_FRAME) {
      delta = tag;
      frame.mode = 3 /* F_SAME */;
      frame.stackCount = 0;
    } else if (tag < MethodWriter.RESERVED) {
      delta = tag - MethodWriter.SAME_LOCALS_1_STACK_ITEM_FRAME;
      stackMap = this.readFrameType(frame.stack, 0, stackMap, c, labels);
      frame.mode = 4 /* F_SAME1 */;
      frame.stackCount = 1;
    } else {
      delta = this.readUnsignedShort(stackMap);
      stackMap += 2;
      if (tag === MethodWriter.SAME_LOCALS_1_STACK_ITEM_FRAME_EXTENDED) {
        stackMap = this.readFrameType(frame.stack, 0, stackMap, c, labels);
        frame.mode = 4 /* F_SAME1 */;
        frame.stackCount = 1;
      } else if (tag >= MethodWriter.CHOP_FRAME && tag < MethodWriter.SAME_FRAME_EXTENDED) {
        frame.mode = 2 /* F_CHOP */;
        frame.localDiff = MethodWriter.SAME_FRAME_EXTENDED - tag;
        frame.localCount -= frame.localDiff;
        frame.stackCount = 0;
      } else if (tag === MethodWriter.SAME_FRAME_EXTENDED) {
        frame.mode = 3 /* F_SAME */;
        frame.stackCount = 0;
      } else if (tag < MethodWriter.FULL_FRAME) {
        let local = unzip ? frame.localCount : 0;
        for (let i = tag - MethodWriter.SAME_FRAME_EXTENDED; i > 0; i--) {
          stackMap = this.readFrameType(frame.local, local++, stackMap, c, labels);
        }
        frame.mode = 1 /* F_APPEND */;
        frame.localDiff = tag - MethodWriter.SAME_FRAME_EXTENDED;
        frame.localCount += frame.localDiff;
        frame.stackCount = 0;
      } else {
        frame.mode = 0 /* F_FULL */;
        let n = this.readUnsignedShort(stackMap);
        stackMap += 2;
        frame.localDiff = n;
        frame.localCount = n;
        for (let local = 0; n > 0; n--) {
          stackMap = this.readFrameType(frame.local, local++, stackMap, c, labels);
        }
        n = this.readUnsignedShort(stackMap);
        stackMap += 2;
        frame.stackCount = n;
        for (let stack = 0; n > 0; n--) {
          stackMap = this.readFrameType(frame.stack, stack++, stackMap, c, labels);
        }
      }
    }
    frame.offset += delta + 1;
    this.readLabel(frame.offset, labels);
    return stackMap;
  }
  /**
     * Reads a stack map frame type and stores it at the given index in the
     * given array.
     *
     * @param frame  the array where the parsed type must be stored.
     * @param index  the index in 'frame' where the parsed type must be stored.
     * @param v      the start offset of the stack map frame type to read.
     * @param buf    a buffer to read strings.
     * @param labels the labels of the method currently being parsed, indexed by
     * their offset. If the parsed type is an Uninitialized type, a
     * new label for the corresponding NEW instruction is stored in
     * this array if it does not already exist.
     * @return the offset of the first byte after the parsed type.
     */
  readFrameType(frame, index, v, buf, labels) {
    const type = this.buf[v++] & 255;
    switch (type) {
      case 0:
        frame[index] = 0 /* TOP */;
        break;
      case 1:
        frame[index] = 1 /* INTEGER */;
        break;
      case 2:
        frame[index] = 2 /* FLOAT */;
        break;
      case 3:
        frame[index] = 3 /* DOUBLE */;
        break;
      case 4:
        frame[index] = 4 /* LONG */;
        break;
      case 5:
        frame[index] = 5 /* NULL */;
        break;
      case 6:
        frame[index] = 6 /* UNINITIALIZED_THIS */;
        break;
      case 7:
        frame[index] = this.readClass(v, buf);
        v += 2;
        break;
      default:
        frame[index] = this.readLabel(this.readUnsignedShort(v), labels);
        v += 2;
    }
    return v;
  }
  /**
     * Returns the label corresponding to the given offset. The default
     * implementation of this method creates a label for the given offset if it
     * has not been already created.
     *
     * @param offset a bytecode offset in a method.
     * @param labels the already created labels, indexed by their offset. If a
     * label already exists for offset this method must not create a
     * new one. Otherwise it must store the new label in this array.
     * @return a non null Label, which must be equal to labels[offset].
     */
  readLabel(offset, labels) {
    if (labels[offset] == null) {
      labels[offset] = new Label();
    }
    return labels[offset];
  }
  /**
     * Returns the start index of the attribute_info structure of this class.
     *
     * @return the start index of the attribute_info structure of this class.
     */
  getAttributes() {
    let u = this.header + 8 + this.readUnsignedShort(this.header + 6) * 2;
    for (let i = this.readUnsignedShort(u); i > 0; --i) {
      for (let j = this.readUnsignedShort(u + 8); j > 0; --j) {
        u += 6 + this.readInt(u + 12);
      }
      u += 8;
    }
    u += 2;
    for (let i = this.readUnsignedShort(u); i > 0; --i) {
      for (let j = this.readUnsignedShort(u + 8); j > 0; --j) {
        u += 6 + this.readInt(u + 12);
      }
      u += 8;
    }
    return u + 2;
  }
  /**
     * Reads an attribute in {@link #b b}.
     *
     * @param attrs   prototypes of the attributes that must be parsed during the
     * visit of the class. Any attribute whose type is not equal to
     * the type of one the prototypes is ignored (i.e. an empty
     * {@link Attribute} instance is returned).
     * @param type    the type of the attribute.
     * @param off     index of the first byte of the attribute's content in
     * {@link #b b}. The 6 attribute header bytes, containing the
     * type and the length of the attribute, are not taken into
     * account here (they have already been read).
     * @param len     the length of the attribute's content.
     * @param buf     buffer to be used to call {@link #readUTF8 readUTF8},
     * {@link #readClass(int, int[]) readClass} or {@link #readConst
     * readConst}.
     * @param codeOff index of the first byte of code's attribute content in
     * {@link #b b}, or -1 if the attribute to be read is not a code
     * attribute. The 6 attribute header bytes, containing the type
     * and the length of the attribute, are not taken into account
     * here.
     * @param labels  the labels of the method's code, or <tt>null</tt> if the
     * attribute to be read is not a code attribute.
     * @return the attribute that has been read, or <tt>null</tt> to skip this
     * attribute.
     */
  readAttribute(attrs, type, off, len, buf, codeOff, labels) {
    for (let i = 0; i < attrs.length; ++i) {
      if (attrs[i].type === type) {
        return attrs[i].read(this, off, len, buf, codeOff, labels);
      }
    }
    return new Attribute(type).read(this, off, len, null, -1, null);
  }
  /**
     * Returns the number of constant pool items in {@link #b b}.
     *
     * @return the number of constant pool items in {@link #b b}.
     */
  getItemCount() {
    return this.items.length;
  }
  /**
     * Returns the start index of the constant pool item in {@link #b b}, plus
     * one. <i>This method is intended for {@link Attribute} sub classes, and is
     * normally not needed by class generators or adapters.</i>
     *
     * @param item the index a constant pool item.
     * @return the start index of the constant pool item in {@link #b b}, plus
     * one.
     */
  getItem(item) {
    return this.items[item];
  }
  /**
     * Returns the maximum length of the strings contained in the constant pool
     * of the class.
     *
     * @return the maximum length of the strings contained in the constant pool
     * of the class.
     */
  getMaxStringLength() {
    return this.maxStringLength;
  }
  /**
     * Reads a byte value in {@link #b b}. <i>This method is intended for
     * {@link Attribute} sub classes, and is normally not needed by class
     * generators or adapters.</i>
     *
     * @param index the start index of the value to be read in {@link #b b}.
     * @return the read value.
     */
  readByte(index) {
    return this.buf[index] & 255;
  }
  /**
     * Reads an unsigned short value in {@link #b b}. <i>This method is intended
     * for {@link Attribute} sub classes, and is normally not needed by class
     * generators or adapters.</i>
     *
     * @param index the start index of the value to be read in {@link #b b}.
     * @return the read value.
     */
  readUnsignedShort(index) {
    const b = this.buf;
    return (b[index] & 255) << 8 | b[index + 1] & 255;
  }
  /**
     * Reads a signed short value in {@link #b b}. <i>This method is intended
     * for {@link Attribute} sub classes, and is normally not needed by class
     * generators or adapters.</i>
     *
     * @param index the start index of the value to be read in {@link #b b}.
     * @return the read value.
     */
  readShort(index) {
    const b = this.buf;
    return b[index] << 8 | b[index + 1];
  }
  /**
     * Reads a signed int value in {@link #b b}. <i>This method is intended for
     * {@link Attribute} sub classes, and is normally not needed by class
     * generators or adapters.</i>
     *
     * @param index the start index of the value to be read in {@link #b b}.
     * @return the read value.
     */
  readInt(index) {
    const b = this.buf;
    return (b[index] & 255) << 24 | (b[index + 1] & 255) << 16 | (b[index + 2] & 255) << 8 | b[index + 3];
  }
  /**
     * Reads a signed long value in {@link #b b}. <i>This method is intended for
     * {@link Attribute} sub classes, and is normally not needed by class
     * generators or adapters.</i>
     *
     * @param index the start index of the value to be read in {@link #b b}.
     * @return the read value.
     */
  readLong(index) {
    const l1 = BigInt(this.readInt(index));
    const l0 = BigInt(this.readInt(index + 4) & 4294967295);
    return l1 << 32n | l0;
  }
  /**
     * Reads an UTF8 string constant pool item in {@link #b b}. <i>This method
     * is intended for {@link Attribute} sub classes, and is normally not needed
     * by class generators or adapters.</i>
     *
     * @param index the start index of an unsigned short value in {@link #b b},
     * whose value is the index of an UTF8 constant pool item.
     * @param buf   buffer to be used to read the item. This buffer must be
     * sufficiently large. It is not automatically resized.
     * @return the String corresponding to the specified UTF8 item.
     */
  readUTF8(index, buf) {
    const item = this.readUnsignedShort(index);
    if (index === 0 || item === 0) {
      return "";
    }
    const s = this.strings[item];
    if (s != null) {
      return s;
    }
    index = this.items[item];
    this.strings[item] = this.readUTF(index + 2, this.readUnsignedShort(index), buf);
    return this.strings[item];
  }
  /**
     * Reads UTF8 string in {@link #b b}.
     *
     * @param index  start offset of the UTF8 string to be read.
     * @param utfLen length of the UTF8 string to be read.
     * @param buf    buffer to be used to read the string. This buffer must be
     * sufficiently large. It is not automatically resized.
     * @return the String corresponding to the specified UTF8 string.
     */
  readUTF(index, utfLen, buf) {
    const endIndex = index + utfLen;
    const b = this.buf;
    let strLen = 0;
    let c;
    let st = 0;
    let cc = 0;
    while (index < endIndex) {
      c = b[index++];
      switch (st) {
        case 0:
          c = c & 255;
          if (c < 128) {
            buf[strLen++] = c;
          } else if (c < 224 && c > 191) {
            cc = c & 31;
            st = 1;
          } else {
            cc = c & 15;
            st = 2;
          }
          break;
        case 1:
          buf[strLen++] = cc << 6 | c & 63;
          st = 0;
          break;
        case 2:
          cc = cc << 6 | c & 63;
          st = 1;
          break;
      }
    }
    return buf.slice(0, strLen).map((c2) => String.fromCharCode(c2)).join("");
  }
  /**
     * Reads a class constant pool item in {@link #b b}. <i>This method is
     * intended for {@link Attribute} sub classes, and is normally not needed by
     * class generators or adapters.</i>
     *
     * @param index the start index of an unsigned short value in {@link #b b},
     * whose value is the index of a class constant pool item.
     * @param buf   buffer to be used to read the item. This buffer must be
     * sufficiently large. It is not automatically resized.
     * @return the String corresponding to the specified class item.
     */
  readClass(index, buf) {
    return this.readUTF8(this.items[this.readUnsignedShort(index)], buf) ?? "";
  }
  /**
     * Reads a numeric or string constant pool item in {@link #b b}. <i>This
     * method is intended for {@link Attribute} sub classes, and is normally not
     * needed by class generators or adapters.</i>
     *
     * @param item the index of a constant pool item.
     * @param buf  buffer to be used to read the item. This buffer must be
     * sufficiently large. It is not automatically resized.
     * @return the {@link Integer}, {@link Float}, {@link Long}, {@link Double},
     * {@link String}, {@link Type} or {@link Handle} corresponding to
     * the given constant pool item.
     */
  readConst(item, buf) {
    const index = this.items[item];
    switch (this.buf[index - 1]) {
      case ClassWriter.INT:
        return this.readInt(index);
      case ClassWriter.FLOAT:
        return intBitsToFloat(this.readInt(index));
      case ClassWriter.LONG:
        return this.readLong(index);
      case ClassWriter.DOUBLE:
        return longBitsToDouble(this.readLong(index));
      case ClassWriter.CLASS:
        return Type.getObjectType(this.readUTF8(index, buf));
      case ClassWriter.STR:
        return this.readUTF8(index, buf);
      case ClassWriter.MTYPE:
        return Type.getMethodType(this.readUTF8(index, buf));
      default:
        const tag = this.readByte(index);
        const items = this.items;
        let cpIndex = items[this.readUnsignedShort(index + 1)];
        const itf = this.buf[cpIndex - 1] === ClassWriter.IMETH;
        const owner = this.readClass(cpIndex, buf);
        cpIndex = items[this.readUnsignedShort(cpIndex + 2)];
        const name = this.readUTF8(cpIndex, buf);
        const desc = this.readUTF8(cpIndex + 2, buf);
        return new Handle(tag, owner, name, desc, itf);
    }
  }
};
var ClassReader = _ClassReader;
/**
  * True to enable signatures support.
  */
__publicField(ClassReader, "SIGNATURES", true);
/**
   * True to enable annotations support.
   */
__publicField(ClassReader, "ANNOTATIONS", true);
/**
   * True to enable stack map frames support.
   */
__publicField(ClassReader, "FRAMES", true);
/**
   * True to enable bytecode writing support.
   */
__publicField(ClassReader, "WRITER", true);
/**
   * True to enable JSR_W and GOTO_W support.
   */
__publicField(ClassReader, "RESIZE", true);
/**
   * Flag to skip method code. If this class is set <code>CODE</code>
   * attribute won't be visited. This can be used, for example, to retrieve
   * annotations for methods and method parameters.
   */
__publicField(ClassReader, "SKIP_CODE", 1);
/**
   * Flag to skip the debug information in the class. If this flag is set the
   * debug information of the class is not visited, i.e. the
   * {@link MethodVisitor#visitLocalVariable visitLocalVariable} and
   * {@link MethodVisitor#visitLineNumber visitLineNumber} methods will not be
   * called.
   */
__publicField(ClassReader, "SKIP_DEBUG", 2);
/**
   * Flag to skip the stack map frames in the class. If this flag is set the
   * stack map frames of the class is not visited, i.e. the
   * {@link MethodVisitor#visitFrame visitFrame} method will not be called.
   * This flag is useful when the {@link ClassWriter#COMPUTE_FRAMES} option is
   * used: it avoids visiting frames that will be ignored and recomputed from
   * scratch in the class writer.
   */
__publicField(ClassReader, "SKIP_FRAMES", 4);
/**
   * Flag to expand the stack map frames. By default stack map frames are
   * visited in their original format (i.e. "expanded" for classes whose
   * version is less than V1_6, and "compressed" for the other classes). If
   * this flag is set, stack map frames are always visited in expanded format
   * (this option adds a decompression/recompression step in ClassReader and
   * ClassWriter which degrades performances quite a lot).
   */
__publicField(ClassReader, "EXPAND_FRAMES", 8);
/**
   * Flag to expand the ASM pseudo instructions into an equivalent sequence of
   * standard bytecode instructions. When resolving a forward jump it may
   * happen that the signed 2 bytes offset reserved for it is not sufficient
   * to store the bytecode offset. In this case the jump instruction is
   * replaced with a temporary ASM pseudo instruction using an unsigned 2
   * bytes offset (see Label#resolve). This internal flag is used to re-read
   * classes containing such instructions, in order to replace them with
   * standard instructions. In addition, when this flag is used, GOTO_W and
   * JSR_W are <i>not</i> converted into GOTO and JSR, to make sure that
   * infinite loops where a GOTO_W is replaced with a GOTO in ClassReader and
   * converted back to a GOTO_W in ClassWriter cannot occur.
   */
__publicField(ClassReader, "EXPAND_ASM_INSNS", 256);

// libs/TypeReference.ts
var _TypeReference = class {
  /**
     * Creates a new TypeReference.
     *
     * @param typeRef
     * the int encoded value of the type reference, as received in a
     * visit method related to type annotations, like
     * visitTypeAnnotation.
     */
  constructor(typeRef) {
    /**
       * The type reference value in Java class file format.
       */
    __publicField(this, "value");
    this.value = 0;
    this.value = typeRef;
  }
  /**
     * Returns a type reference of the given sort.
     *
     * @param sort
     * {@link #FIELD FIELD}, {@link #METHOD_RETURN METHOD_RETURN},
     * {@link #METHOD_RECEIVER METHOD_RECEIVER},
     * {@link #LOCAL_VARIABLE LOCAL_VARIABLE},
     * {@link #RESOURCE_VARIABLE RESOURCE_VARIABLE},
     * {@link #INSTANCEOF INSTANCEOF}, {@link #NEW NEW},
     * {@link #CONSTRUCTOR_REFERENCE CONSTRUCTOR_REFERENCE}, or
     * {@link #METHOD_REFERENCE METHOD_REFERENCE}.
     * @return a type reference of the given sort.
     */
  static newTypeReference(sort) {
    return new _TypeReference(sort << 24);
  }
  /**
     * Returns a reference to a type parameter of a generic class or method.
     *
     * @param sort
     * {@link #CLASS_TYPE_PARAMETER CLASS_TYPE_PARAMETER} or
     * {@link #METHOD_TYPE_PARAMETER METHOD_TYPE_PARAMETER}.
     * @param paramIndex
     * the type parameter index.
     * @return a reference to the given generic class or method type parameter.
     */
  static newTypeParameterReference(sort, paramIndex) {
    return new _TypeReference(sort << 24 | paramIndex << 16);
  }
  /**
     * Returns a reference to a type parameter bound of a generic class or
     * method.
     *
     * @param sort
     * {@link #CLASS_TYPE_PARAMETER CLASS_TYPE_PARAMETER} or
     * {@link #METHOD_TYPE_PARAMETER METHOD_TYPE_PARAMETER}.
     * @param paramIndex
     * the type parameter index.
     * @param boundIndex
     * the type bound index within the above type parameters.
     * @return a reference to the given generic class or method type parameter
     * bound.
     */
  static newTypeParameterBoundReference(sort, paramIndex, boundIndex) {
    return new _TypeReference(sort << 24 | paramIndex << 16 | boundIndex << 8);
  }
  /**
     * Returns a reference to the super class or to an interface of the
     * 'implements' clause of a class.
     *
     * @param itfIndex
     * the index of an interface in the 'implements' clause of a
     * class, or -1 to reference the super class of the class.
     * @return a reference to the given super type of a class.
     */
  static newSuperTypeReference(itfIndex) {
    itfIndex &= 65535;
    return new _TypeReference(_TypeReference.CLASS_EXTENDS << 24 | itfIndex << 8);
  }
  /**
     * Returns a reference to the type of a formal parameter of a method.
     *
     * @param paramIndex
     * the formal parameter index.
     *
     * @return a reference to the type of the given method formal parameter.
     */
  static newFormalParameterReference(paramIndex) {
    return new _TypeReference(_TypeReference.METHOD_FORMAL_PARAMETER << 24 | paramIndex << 16);
  }
  /**
     * Returns a reference to the type of an exception, in a 'throws' clause of
     * a method.
     *
     * @param exceptionIndex
     * the index of an exception in a 'throws' clause of a method.
     *
     * @return a reference to the type of the given exception.
     */
  static newExceptionReference(exceptionIndex) {
    return new _TypeReference(_TypeReference.THROWS << 24 | exceptionIndex << 8);
  }
  /**
     * Returns a reference to the type of the exception declared in a 'catch'
     * clause of a method.
     *
     * @param tryCatchBlockIndex
     * the index of a try catch block (using the order in which they
     * are visited with visitTryCatchBlock).
     *
     * @return a reference to the type of the given exception.
     */
  static newTryCatchReference(tryCatchBlockIndex) {
    return new _TypeReference(_TypeReference.EXCEPTION_PARAMETER << 24 | tryCatchBlockIndex << 8);
  }
  /**
     * Returns a reference to the type of a type argument in a constructor or
     * method call or reference.
     *
     * @param sort
     * {@link #CAST CAST},
     * {@link #CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT
     * CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT},
     * {@link #METHOD_INVOCATION_TYPE_ARGUMENT
     * METHOD_INVOCATION_TYPE_ARGUMENT},
     * {@link #CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT
     * CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT}, or
     * {@link #METHOD_REFERENCE_TYPE_ARGUMENT
     * METHOD_REFERENCE_TYPE_ARGUMENT}.
     * @param argIndex
     * the type argument index.
     *
     * @return a reference to the type of the given type argument.
     */
  static newTypeArgumentReference(sort, argIndex) {
    return new _TypeReference(sort << 24 | argIndex);
  }
  /**
     * Returns the sort of this type reference.
     *
     * @return {@link #CLASS_TYPE_PARAMETER CLASS_TYPE_PARAMETER},
     * {@link #METHOD_TYPE_PARAMETER METHOD_TYPE_PARAMETER},
     * {@link #CLASS_EXTENDS CLASS_EXTENDS},
     * {@link #CLASS_TYPE_PARAMETER_BOUND CLASS_TYPE_PARAMETER_BOUND},
     * {@link #METHOD_TYPE_PARAMETER_BOUND METHOD_TYPE_PARAMETER_BOUND},
     * {@link #FIELD FIELD}, {@link #METHOD_RETURN METHOD_RETURN},
     * {@link #METHOD_RECEIVER METHOD_RECEIVER},
     * {@link #METHOD_FORMAL_PARAMETER METHOD_FORMAL_PARAMETER},
     * {@link #THROWS THROWS}, {@link #LOCAL_VARIABLE LOCAL_VARIABLE},
     * {@link #RESOURCE_VARIABLE RESOURCE_VARIABLE},
     * {@link #EXCEPTION_PARAMETER EXCEPTION_PARAMETER},
     * {@link #INSTANCEOF INSTANCEOF}, {@link #NEW NEW},
     * {@link #CONSTRUCTOR_REFERENCE CONSTRUCTOR_REFERENCE},
     * {@link #METHOD_REFERENCE METHOD_REFERENCE}, {@link #CAST CAST},
     * {@link #CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT
     * CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT},
     * {@link #METHOD_INVOCATION_TYPE_ARGUMENT
     * METHOD_INVOCATION_TYPE_ARGUMENT},
     * {@link #CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT
     * CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT}, or
     * {@link #METHOD_REFERENCE_TYPE_ARGUMENT
     * METHOD_REFERENCE_TYPE_ARGUMENT}.
     */
  getSort() {
    return this.value >>> 24;
  }
  /**
     * Returns the index of the type parameter referenced by this type
     * reference. This method must only be used for type references whose sort
     * is {@link #CLASS_TYPE_PARAMETER CLASS_TYPE_PARAMETER},
     * {@link #METHOD_TYPE_PARAMETER METHOD_TYPE_PARAMETER},
     * {@link #CLASS_TYPE_PARAMETER_BOUND CLASS_TYPE_PARAMETER_BOUND} or
     * {@link #METHOD_TYPE_PARAMETER_BOUND METHOD_TYPE_PARAMETER_BOUND}.
     *
     * @return a type parameter index.
     */
  getTypeParameterIndex() {
    return (this.value & 16711680) >> 16;
  }
  /**
     * Returns the index of the type parameter bound, within the type parameter
     * {@link #getTypeParameterIndex}, referenced by this type reference. This
     * method must only be used for type references whose sort is
     * {@link #CLASS_TYPE_PARAMETER_BOUND CLASS_TYPE_PARAMETER_BOUND} or
     * {@link #METHOD_TYPE_PARAMETER_BOUND METHOD_TYPE_PARAMETER_BOUND}.
     *
     * @return a type parameter bound index.
     */
  getTypeParameterBoundIndex() {
    return (this.value & 65280) >> 8;
  }
  /**
     * Returns the index of the "super type" of a class that is referenced by
     * this type reference. This method must only be used for type references
     * whose sort is {@link #CLASS_EXTENDS CLASS_EXTENDS}.
     *
     * @return the index of an interface in the 'implements' clause of a class,
     * or -1 if this type reference references the type of the super
     * class.
     */
  getSuperTypeIndex() {
    return (this.value & 16776960) >> 8 | 0;
  }
  /**
     * Returns the index of the formal parameter whose type is referenced by
     * this type reference. This method must only be used for type references
     * whose sort is {@link #METHOD_FORMAL_PARAMETER METHOD_FORMAL_PARAMETER}.
     *
     * @return a formal parameter index.
     */
  getFormalParameterIndex() {
    return (this.value & 16711680) >> 16;
  }
  /**
     * Returns the index of the exception, in a 'throws' clause of a method,
     * whose type is referenced by this type reference. This method must only be
     * used for type references whose sort is {@link #THROWS THROWS}.
     *
     * @return the index of an exception in the 'throws' clause of a method.
     */
  getExceptionIndex() {
    return (this.value & 16776960) >> 8;
  }
  /**
     * Returns the index of the try catch block (using the order in which they
     * are visited with visitTryCatchBlock), whose 'catch' type is referenced by
     * this type reference. This method must only be used for type references
     * whose sort is {@link #EXCEPTION_PARAMETER EXCEPTION_PARAMETER} .
     *
     * @return the index of an exception in the 'throws' clause of a method.
     */
  getTryCatchBlockIndex() {
    return (this.value & 16776960) >> 8;
  }
  /**
     * Returns the index of the type argument referenced by this type reference.
     * This method must only be used for type references whose sort is
     * {@link #CAST CAST}, {@link #CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT
     * CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT},
     * {@link #METHOD_INVOCATION_TYPE_ARGUMENT METHOD_INVOCATION_TYPE_ARGUMENT},
     * {@link #CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT
     * CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT}, or
     * {@link #METHOD_REFERENCE_TYPE_ARGUMENT METHOD_REFERENCE_TYPE_ARGUMENT}.
     *
     * @return a type parameter index.
     */
  getTypeArgumentIndex() {
    return this.value & 255;
  }
  /**
     * Returns the int encoded value of this type reference, suitable for use in
     * visit methods related to type annotations, like visitTypeAnnotation.
     *
     * @return the int encoded value of this type reference.
     */
  getValue() {
    return this.value;
  }
};
var TypeReference = _TypeReference;
/**
   * The sort of type references that target a type parameter of a generic
   * class. See {@link #getSort getSort}.
   */
__publicField(TypeReference, "CLASS_TYPE_PARAMETER", 0);
/**
   * The sort of type references that target a type parameter of a generic
   * method. See {@link #getSort getSort}.
   */
__publicField(TypeReference, "METHOD_TYPE_PARAMETER", 1);
/**
   * The sort of type references that target the super class of a class or one
   * of the interfaces it implements. See {@link #getSort getSort}.
   */
__publicField(TypeReference, "CLASS_EXTENDS", 16);
/**
   * The sort of type references that target a bound of a type parameter of a
   * generic class. See {@link #getSort getSort}.
   */
__publicField(TypeReference, "CLASS_TYPE_PARAMETER_BOUND", 17);
/**
   * The sort of type references that target a bound of a type parameter of a
   * generic method. See {@link #getSort getSort}.
   */
__publicField(TypeReference, "METHOD_TYPE_PARAMETER_BOUND", 18);
/**
   * The sort of type references that target the type of a field. See
   * {@link #getSort getSort}.
   */
__publicField(TypeReference, "FIELD", 19);
/**
   * The sort of type references that target the return type of a method. See
   * {@link #getSort getSort}.
   */
__publicField(TypeReference, "METHOD_RETURN", 20);
/**
   * The sort of type references that target the receiver type of a method.
   * See {@link #getSort getSort}.
   */
__publicField(TypeReference, "METHOD_RECEIVER", 21);
/**
   * The sort of type references that target the type of a formal parameter of
   * a method. See {@link #getSort getSort}.
   */
__publicField(TypeReference, "METHOD_FORMAL_PARAMETER", 22);
/**
   * The sort of type references that target the type of an exception declared
   * in the throws clause of a method. See {@link #getSort getSort}.
   */
__publicField(TypeReference, "THROWS", 23);
/**
   * The sort of type references that target the type of a local variable in a
   * method. See {@link #getSort getSort}.
   */
__publicField(TypeReference, "LOCAL_VARIABLE", 64);
/**
   * The sort of type references that target the type of a resource variable
   * in a method. See {@link #getSort getSort}.
   */
__publicField(TypeReference, "RESOURCE_VARIABLE", 65);
/**
   * The sort of type references that target the type of the exception of a
   * 'catch' clause in a method. See {@link #getSort getSort}.
   */
__publicField(TypeReference, "EXCEPTION_PARAMETER", 66);
/**
   * The sort of type references that target the type declared in an
   * 'instanceof' instruction. See {@link #getSort getSort}.
   */
__publicField(TypeReference, "INSTANCEOF", 67);
/**
   * The sort of type references that target the type of the object created by
   * a 'new' instruction. See {@link #getSort getSort}.
   */
__publicField(TypeReference, "NEW", 68);
/**
   * The sort of type references that target the receiver type of a
   * constructor reference. See {@link #getSort getSort}.
   */
__publicField(TypeReference, "CONSTRUCTOR_REFERENCE", 69);
/**
   * The sort of type references that target the receiver type of a method
   * reference. See {@link #getSort getSort}.
   */
__publicField(TypeReference, "METHOD_REFERENCE", 70);
/**
   * The sort of type references that target the type declared in an explicit
   * or implicit cast instruction. See {@link #getSort getSort}.
   */
__publicField(TypeReference, "CAST", 71);
/**
   * The sort of type references that target a type parameter of a generic
   * constructor in a constructor call. See {@link #getSort getSort}.
   */
__publicField(TypeReference, "CONSTRUCTOR_INVOCATION_TYPE_ARGUMENT", 72);
/**
   * The sort of type references that target a type parameter of a generic
   * method in a method call. See {@link #getSort getSort}.
   */
__publicField(TypeReference, "METHOD_INVOCATION_TYPE_ARGUMENT", 73);
/**
   * The sort of type references that target a type parameter of a generic
   * constructor in a constructor reference. See {@link #getSort getSort}.
   */
__publicField(TypeReference, "CONSTRUCTOR_REFERENCE_TYPE_ARGUMENT", 74);
/**
   * The sort of type references that target a type parameter of a generic
   * method in a method reference. See {@link #getSort getSort}.
   */
__publicField(TypeReference, "METHOD_REFERENCE_TYPE_ARGUMENT", 75);
//# sourceMappingURL=index.js.map
