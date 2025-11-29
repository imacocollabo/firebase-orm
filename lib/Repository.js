"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TransactionManager = exports.Repository = exports.Fetcher = void 0;
exports.addDBToPool = addDBToPool;
exports.use = use;
exports.takeDBFromPool = takeDBFromPool;
exports.getCurrentDB = getCurrentDB;
exports.makeNestedCollectionReference = makeNestedCollectionReference;
exports.getRepository = getRepository;
exports.runTransaction = runTransaction;
exports._getDocumentReference = _getDocumentReference;
const Entity_1 = require("./Entity");
const EntityBuilder_1 = require("./EntityBuilder");
const Error_1 = require("./Error");
class Fetcher {
    meta;
    ref;
    constructor(meta, ref) {
        this.meta = meta;
        this.ref = ref;
    }
    async fetchOne(options) {
        const result = await this.ref.get();
        const unoboxed = result.unbox();
        if (!unoboxed || !unoboxed[0]) {
            return null;
        }
        const resource = (0, EntityBuilder_1.buildEntity)(this.meta, unoboxed[0], this.ref, options);
        (0, Entity_1.callHook)(this.meta, resource, 'afterLoad');
        return resource;
    }
    async fetchOneOrFail(options) {
        const item = await this.fetchOne(options);
        if (!item) {
            throw new Error_1.RecordNotFoundError(this.meta.Entity);
        }
        return item;
    }
    async fetchAll(options) {
        const result = await this.ref.get();
        const docs = result.unbox();
        if (!docs) {
            return [];
        }
        const results = [];
        for (const data of docs) {
            const resource = await (0, EntityBuilder_1.buildEntity)(this.meta, data, this.ref, options);
            (0, Entity_1.callHook)(this.meta, resource, 'afterLoad');
            results.push(resource);
        }
        return results;
    }
    onSnapShot(callback, options) {
        const unsubscribe = this.ref.ref.onSnapshot(async (snapshot) => {
            for (const change of snapshot.docChanges()) {
                const ref = new EntityBuilder_1.FirestoreReference(change.doc.ref);
                const result = await ref.get();
                const unoboxed = result.unbox();
                if (!unoboxed || !unoboxed[0]) {
                    callback({
                        type: change.type,
                        id: ref.ref.id,
                    });
                }
                else {
                    const resource = await (0, EntityBuilder_1.buildEntity)(this.meta, unoboxed[0], ref, options);
                    (0, Entity_1.callHook)(this.meta, resource, 'afterLoad');
                    callback({
                        type: change.type,
                        id: ref.ref.id,
                        item: resource,
                    });
                }
            }
        });
        return unsubscribe;
    }
}
exports.Fetcher = Fetcher;
const dbPool = {};
let currentConnectionName = null;
function addDBToPool(name, db) {
    if (!currentConnectionName) {
        currentConnectionName = name;
    }
    dbPool[name] = db;
}
function use(name) {
    const keys = Object.keys(dbPool);
    if (!keys.includes(name)) {
        throw new Error(`Could not find db named: ${name}`);
    }
    currentConnectionName = name;
}
function takeDBFromPool(name) {
    return dbPool[name];
}
function getCurrentDB() {
    return dbPool[currentConnectionName];
}
function createSavingParams(meta, resource) {
    const savingParams = {};
    for (const key in resource) {
        if (resource[key] === undefined) {
            continue;
        }
        const column = meta.columns.filter(x => key === x.propertyKey)[0];
        if (!column) {
            continue;
        }
        if (column instanceof Entity_1._ColumnSetting) {
            const keyInForestore = column.option?.name || column.propertyKey;
            savingParams[keyInForestore] = resource[key];
        }
        else if (column instanceof Entity_1._ManyToOneSetting) {
            if (!column.option?.joinColumnName) {
                continue;
            }
            const joinColumnName = column.option.joinColumnName;
            const ref = _getDocumentReference(resource[key]);
            if (!ref) {
                throw new Error('document reference should not be empty');
            }
            savingParams[joinColumnName] = ref;
        }
        else if (column instanceof Entity_1._OneToOneSetting) {
            if (!column.option?.joinColumnName) {
                continue;
            }
            const joinColumnName = column.option.joinColumnName;
            const ref = _getDocumentReference(resource[key]);
            if (!ref) {
                throw new Error('document reference should not be empty');
            }
            savingParams[joinColumnName] = ref;
        }
        else if (column instanceof Entity_1._ArrayReference) {
            if (!column.option?.joinColumnName) {
                continue;
            }
            const joinColumnName = column.option.joinColumnName;
            const children = resource[key];
            if (!Array.isArray(children)) {
                throw new Error(`${key} is not an array`);
            }
            const refs = [];
            for (const child of children) {
                const ref = _getDocumentReference(child);
                if (!ref) {
                    throw new Error('document reference should not be empty');
                }
                refs.push(ref);
            }
            savingParams[joinColumnName] = refs;
        }
    }
    return savingParams;
}
function createUpdatingParams(meta, resource, paramsForUpdate) {
    const copied = { ...resource };
    Object.assign(copied, paramsForUpdate);
    const savingParams = createSavingParams(meta, copied);
    const updatingParams = {};
    const savingKeys = Object.keys(paramsForUpdate);
    for (const key in savingParams) {
        if (!savingKeys.includes(key)) {
            continue;
        }
        updatingParams[key] = savingParams[key];
    }
    return updatingParams;
}
class Repository {
    Entity;
    transaction;
    parentIdMapper;
    db;
    constructor(Entity, transaction, parentIdMapper, db) {
        this.Entity = Entity;
        this.transaction = transaction;
        this.parentIdMapper = parentIdMapper;
        this.db = db;
    }
    setTransaction(transaction) {
        this.transaction = transaction;
    }
    prepareFetcher(condition) {
        const meta = (0, Entity_1.findMeta)(this.Entity);
        const colRef = this.collectionReference(meta);
        const ref = new EntityBuilder_1.FirestoreReference(condition(colRef), this.transaction);
        return new Fetcher(meta, ref);
    }
    fetchOneById(id, options) {
        return this.prepareFetcher(ref => ref.doc(id)).fetchOne(options);
    }
    fetchOneByIdOrFail(id, options) {
        return this.prepareFetcher(ref => ref.doc(id)).fetchOneOrFail(options);
    }
    fetchAll(options) {
        return this.prepareFetcher(ref => ref).fetchAll(options);
    }
    onSnapShot(callback, options) {
        return this.prepareFetcher(ref => ref).onSnapShot(callback, options);
    }
    async save(resource) {
        const documentReference = _getDocumentReference(resource);
        if (this.transaction && documentReference) {
            if (documentReference.id !== resource.id) {
                throw new Error('The resource is broken.');
            }
            const Entity = resource.constructor;
            const meta = (0, Entity_1.findMeta)(Entity);
            (0, Entity_1.callHook)(meta, resource, 'beforeSave');
            const params = createSavingParams(meta, resource);
            await this.transaction.set(documentReference, params);
            (0, Entity_1.callHook)(meta, resource, 'afterSave');
            return resource;
        }
        else {
            const meta = (0, Entity_1.findMeta)(this.Entity);
            let _ref;
            if (resource.id) {
                _ref = this.collectionReference(meta).doc(resource.id);
            }
            else {
                _ref = this.collectionReference(meta).doc();
            }
            const ref = new EntityBuilder_1.FirestoreReference(_ref, this.transaction);
            (0, Entity_1.callHook)(meta, resource, 'beforeSave');
            const savingParams = createSavingParams(meta, resource);
            await ref.set(savingParams);
            if (!resource.id) {
                resource.id = ref.ref.id;
            }
            resource[EntityBuilder_1.documentReferencePath] = _ref;
            (0, Entity_1.callHook)(meta, resource, 'afterSave');
            return resource;
        }
    }
    async update(resource, params) {
        const documentReference = _getDocumentReference(resource);
        if (!documentReference) {
            throw new Error('Can not update the resource due to non existed resource on firestore.');
        }
        if (documentReference.id !== resource.id) {
            throw new Error('The resource is broken.');
        }
        if (this.transaction && documentReference) {
            const Entity = resource.constructor;
            const meta = (0, Entity_1.findMeta)(Entity);
            (0, Entity_1.callHook)(meta, [resource, params], 'beforeSave');
            const updatingParams = createUpdatingParams(meta, resource, params);
            await this.transaction.update(documentReference, updatingParams);
            Object.assign(resource, params);
            (0, Entity_1.callHook)(meta, resource, 'afterSave');
            return resource;
        }
        else {
            const meta = (0, Entity_1.findMeta)(this.Entity);
            const ref = new EntityBuilder_1.FirestoreReference(this.collectionReference(meta).doc(resource.id), this.transaction);
            const updatingParams = createUpdatingParams(meta, resource, params);
            (0, Entity_1.callHook)(meta, [resource, params], 'beforeSave');
            await ref.update(updatingParams);
            Object.assign(resource, params);
            (0, Entity_1.callHook)(meta, resource, 'afterSave');
        }
        return resource;
    }
    async delete(resourceOrId) {
        const ref = _getDocumentReference(resourceOrId);
        if (ref) {
            if (this.transaction) {
                await this.transaction.delete(ref);
            }
            else {
                await ref.delete();
            }
        }
        else {
            const meta = (0, Entity_1.findMeta)(this.Entity);
            const ref = this.collectionReference(meta).doc(resourceOrId);
            if (this.transaction) {
                await this.transaction.delete(ref);
            }
            else {
                await ref.delete();
            }
        }
    }
    collectionReference(meta) {
        if (this.parentIdMapper) {
            return makeNestedCollectionReference(meta, this.parentIdMapper, this.db);
        }
        else {
            if (this.db) {
                return this.db.collection(meta.tableName);
            }
            else {
                return getCurrentDB().collection(meta.tableName);
            }
        }
    }
}
exports.Repository = Repository;
function makeNestedCollectionReference(meta, parentIdMapper, _db) {
    let ref = null;
    for (const parentEntityGetter of meta.parentEntityGetters || []) {
        const parentMeta = (0, Entity_1.findMeta)(parentEntityGetter());
        const parentId = parentIdMapper(parentMeta.Entity);
        if (ref) {
            ref = ref.collection(parentMeta.tableName).doc(parentId);
        }
        else {
            const db = _db || getCurrentDB();
            ref = db.collection(parentMeta.tableName).doc(parentId);
        }
    }
    if (!ref) {
        throw new Error(`${this.Entity} is not NestedFirebaseEntity`);
    }
    return ref.collection(meta.tableName);
}
function getRepository(Entity, params, db) {
    if (params) {
        return new Repository(Entity, undefined, params.parentIdMapper, db);
    }
    return new Repository(Entity, undefined, undefined, db);
}
class TransactionManager {
    transaction;
    constructor(transaction) {
        this.transaction = transaction;
    }
    getRepository(Entity, params, db) {
        if (params) {
            return new Repository(Entity, this.transaction, params.parentIdMapper, db);
        }
        return new Repository(Entity, this.transaction, undefined, db);
    }
}
exports.TransactionManager = TransactionManager;
function runTransaction(callback) {
    return getCurrentDB().runTransaction(async (transaction) => {
        const manager = new TransactionManager(transaction);
        return callback(manager);
    });
}
function _getDocumentReference(item) {
    return item[EntityBuilder_1.documentReferencePath];
}
//# sourceMappingURL=Repository.js.map