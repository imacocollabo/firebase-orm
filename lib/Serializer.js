"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FirebaseEntityDeserializer = exports.FirebaseEntitySerializer = exports.referenceCluePath = void 0;
const Entity_1 = require("./Entity");
const EntityBuilder_1 = require("./EntityBuilder");
const Repository_1 = require("./Repository");
exports.referenceCluePath = '__reference_clue__';
function makeClue(obj, parentIdMapper) {
    const meta = (0, Entity_1.findMeta)(obj.constructor);
    let parentInfo = null;
    if (meta.parentEntityGetters && parentIdMapper) {
        for (const getter of meta.parentEntityGetters) {
            const Entity = getter();
            const meta = (0, Entity_1.findMeta)(Entity);
            if (parentInfo) {
                parentInfo.child = {
                    collection: meta.tableName,
                    id: parentIdMapper(Entity),
                };
            }
            else {
                parentInfo = {
                    collection: meta.tableName,
                    id: parentIdMapper(Entity),
                };
            }
        }
    }
    return {
        collection: meta.tableName,
        id: obj.id,
        parent: parentInfo || null,
    };
}
function hasOwnProperty(obj, prop) {
    return obj.hasOwnProperty(prop);
}
class FirebaseEntitySerializer {
    static serializeToJSON(object, parentIdMapper, options) {
        const meta = (0, Entity_1.findMeta)(object.constructor);
        if (!meta) {
            throw new Error('object is not an Entity.');
        }
        if (meta.parentEntityGetters && !parentIdMapper) {
            throw new Error(`${meta.tableName} is nested collection. So parentId have to be provided.`);
        }
        const columns = meta.columns.map(x => x.propertyKey);
        const serialized = {};
        for (const key in object) {
            if (!columns.includes(key)) {
                continue;
            }
            const item = object[key];
            if (!item) {
                continue;
            }
            if (Array.isArray(item)) {
                serialized[key] = item.map(x => {
                    const ref = (0, Repository_1._getDocumentReference)(x);
                    if (ref) {
                        return {
                            ...FirebaseEntitySerializer.serializeToJSON(x),
                            [exports.referenceCluePath]: makeClue(x, object.id),
                        };
                    }
                    else {
                        return x;
                    }
                });
            }
            else {
                const ref = (0, Repository_1._getDocumentReference)(item);
                if (ref) {
                    serialized[key] = {
                        ...FirebaseEntitySerializer.serializeToJSON(item),
                        [exports.referenceCluePath]: makeClue(item, object.id),
                    };
                }
                else {
                    if (options?.timeStampToString && item.toDate) {
                        serialized[key] = item.toDate().toString();
                    }
                    else {
                        serialized[key] = item;
                    }
                }
            }
        }
        serialized[exports.referenceCluePath] = makeClue(object, parentIdMapper);
        return serialized;
    }
    static serializeToJSONString(object, parentIdMapper) {
        const json = this.serializeToJSON(object, parentIdMapper);
        return JSON.stringify(json);
    }
}
exports.FirebaseEntitySerializer = FirebaseEntitySerializer;
class FirebaseEntityDeserializer {
    static deserializeFromJSON(Entity, object, parentIdMapper, options) {
        const meta = (0, Entity_1.findMeta)(Entity);
        if (!meta) {
            throw new Error('object is not an Entity.');
        }
        const instance = new Entity();
        if (meta.parentEntityGetters) {
            if (!parentIdMapper) {
                throw new Error(`${meta.tableName} is nested collection. So parentId have to be provided.`);
            }
            const reference = (0, Repository_1.makeNestedCollectionReference)(meta, parentIdMapper).doc(object.id);
            instance[EntityBuilder_1.documentReferencePath] = reference;
        }
        else {
            const reference = (0, Repository_1.getCurrentDB)()
                .collection(meta.tableName)
                .doc(object.id);
            instance[EntityBuilder_1.documentReferencePath] = reference;
        }
        for (const key in object) {
            const item = object[key];
            if (!item) {
                continue;
            }
            if (item[exports.referenceCluePath]) {
                instance[key] = plainToClass(item, parentIdMapper);
            }
            else if (Array.isArray(item)) {
                instance[key] = item.map(x => plainToClass(x, parentIdMapper));
            }
            else {
                if (key == exports.referenceCluePath) {
                    continue;
                }
                const index = meta.columns.findIndex(x => x.propertyKey === key);
                const column = meta.columns[index];
                if (options?.stringToTimeStamp &&
                    column instanceof Entity_1._ColumnSetting &&
                    column.columnType &&
                    column.columnType.now) {
                    const date = new Date(item);
                    instance[key] = new column.columnType(Math.floor(date.getTime() / 1000), date.getMilliseconds());
                }
                else {
                    instance[key] = item;
                }
            }
        }
        return instance;
    }
    static deserializeFromJSONString(Entity, str, parentIdMapper) {
        return this.deserializeFromJSON(Entity, JSON.parse(str), parentIdMapper);
    }
}
exports.FirebaseEntityDeserializer = FirebaseEntityDeserializer;
function plainToClass(item, parentIdMapper) {
    const clue = item[exports.referenceCluePath];
    const meta = (0, Entity_1.findMetaFromTableName)(clue.collection);
    if (!meta) {
        throw new Error(`Cloud not find a collection: ${clue.collection}`);
    }
    const child = new meta.Entity();
    for (const key in item) {
        if (key == exports.referenceCluePath) {
            continue;
        }
        if (item[key][exports.referenceCluePath]) {
            child[key] = FirebaseEntityDeserializer.deserializeFromJSON(meta.Entity, item[key], parentIdMapper);
        }
        else {
            child[key] = item[key];
        }
    }
    let reference;
    if (meta.parentEntityGetters) {
        if (!parentIdMapper) {
            throw new Error(`${meta.tableName} is nested collection. So parentId have to be provided.`);
        }
        reference = (0, Repository_1.makeNestedCollectionReference)(meta, parentIdMapper).doc(clue.id);
    }
    else {
        reference = (0, Repository_1.getCurrentDB)().collection(meta.tableName).doc(clue.id);
    }
    child[EntityBuilder_1.documentReferencePath] = reference;
    return child;
}
//# sourceMappingURL=Serializer.js.map