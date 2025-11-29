"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordNotFoundError = void 0;
class RecordNotFoundError extends Error {
    Entity;
    name = 'RecordNotFoundError';
    constructor(Entity) {
        super(`${Entity.name} was not found.`);
        this.Entity = Entity;
        Object.setPrototypeOf(this, RecordNotFoundError.prototype);
    }
    toString() {
        return this.name + ': ' + this.message;
    }
}
exports.RecordNotFoundError = RecordNotFoundError;
//# sourceMappingURL=Error.js.map