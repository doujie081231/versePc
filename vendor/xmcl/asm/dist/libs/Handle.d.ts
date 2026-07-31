export declare class Handle {
    /**
       * The kind of field or method designated by this Handle. Should be
       * {@link Opcodes#H_GETFIELD}, {@link Opcodes#H_GETSTATIC},
       * {@link Opcodes#H_PUTFIELD}, {@link Opcodes#H_PUTSTATIC},
       * {@link Opcodes#H_INVOKEVIRTUAL}, {@link Opcodes#H_INVOKESTATIC},
       * {@link Opcodes#H_INVOKESPECIAL}, {@link Opcodes#H_NEWINVOKESPECIAL} or
       * {@link Opcodes#H_INVOKEINTERFACE}.
       */
    readonly tag: number;
    /**
       * The internal name of the class that owns the field or method designated
       * by this handle.
       */
    readonly owner: string;
    /**
       * The name of the field or method designated by this handle.
       */
    readonly name: string;
    /**
       * The descriptor of the field or method designated by this handle.
       */
    readonly descriptor: string;
    /**
       * Indicate if the owner is an interface or not.
       */
    readonly isInterface: boolean;
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
    constructor(tag: number, owner: string, name: string, desc: string, itf?: boolean);
    equals(obj: any): boolean;
    hashCode(): number;
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
    toString(): string;
}
//# sourceMappingURL=Handle.d.ts.map