"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RelationNotFoundError = exports.FirestoreReference = exports.SnapShotBox = exports.documentReferencePath = void 0;
exports.buildEntity = buildEntity;
const Entity_1 = require("./Entity");
const Repository_1 = require("./Repository");
const type_mapper_1 = require("./type-mapper");
exports.documentReferencePath = '__firestore_document_reference__';
function isBrowserOptimizedDocumentSnapshot(snapshot) {
    return snapshot.data && 'exists' in snapshot;
}
function isBrowserOptimizedQuerySnapshot(snapshot) {
    return snapshot.docs && 'size' in snapshot;
}
function isBrowserOptimizedDocumentReference(snapshot) {
    return snapshot.set && snapshot.delete && snapshot.get;
}
class SnapShotBox {
    snapshot;
    constructor(snapshot) {
        this.snapshot = snapshot;
    }
    unbox() {
        if (this.snapshot instanceof type_mapper_1.firestore.DocumentSnapshot || isBrowserOptimizedDocumentSnapshot(this.snapshot)) {
            const snapshot = this.snapshot;
            if (!snapshot.exists) {
                return null;
            }
            return [{ ...{ id: snapshot.id, [exports.documentReferencePath]: snapshot.ref }, ...snapshot.data() }];
        }
        else if (this.snapshot instanceof type_mapper_1.firestore.QuerySnapshot || isBrowserOptimizedQuerySnapshot(this.snapshot)) {
            if (this.snapshot.size == 0) {
                return [];
            }
            return this.snapshot.docs.map(x => {
                return { ...{ id: x.id, [exports.documentReferencePath]: x.ref }, ...x.data() };
            });
        }
        return null;
    }
}
exports.SnapShotBox = SnapShotBox;
class FirestoreReference {
    ref;
    transaction;
    constructor(ref, transaction) {
        this.ref = ref;
        this.transaction = transaction;
    }
    async get() {
        if (this.transaction) {
            const box = new SnapShotBox(await this.transaction.get(this.ref));
            return box;
        }
        else {
            return new SnapShotBox(await this.ref.get());
        }
    }
    async set(params) {
        if (this.ref instanceof type_mapper_1.firestore.DocumentReference || isBrowserOptimizedDocumentReference(this.ref)) {
            const ref = this.ref;
            if (this.transaction) {
                await this.transaction.set(ref, params);
                return;
            }
            else {
                await ref.set(params);
                return;
            }
        }
        throw new Error('reference should be DocumentReference');
    }
    async update(params) {
        if (this.ref instanceof type_mapper_1.firestore.DocumentReference || isBrowserOptimizedDocumentReference(this.ref)) {
            const ref = this.ref;
            if (this.transaction) {
                await this.transaction.update(ref, params);
                return;
            }
            else {
                await ref.update(params);
                return;
            }
        }
        throw new Error('reference should be DocumentReference');
    }
}
exports.FirestoreReference = FirestoreReference;
class RelationNotFoundError extends Error {
    relation;
    name = 'RelationNotFoundError';
    constructor(relation) {
        super(`relation ${relation} is not exists.`);
        this.relation = relation;
        Object.setPrototypeOf(this, RelationNotFoundError.prototype);
    }
    toString() {
        return this.name + ': ' + this.message;
    }
}
exports.RelationNotFoundError = RelationNotFoundError;
function relationToGroup(relations) {
    const grouped = {};
    for (const relation of relations) {
        const comp = relation.split('.');
        if (comp.length == 1) {
            if (!grouped[comp[0]]) {
                grouped[comp[0]] = {};
            }
        }
        else {
            const top = comp.shift();
            if (!grouped[top]) {
                grouped[top] = {};
            }
            Object.assign(grouped[top], relationToGroup([comp.join('.')]));
        }
    }
    return grouped;
}
function groupToRelation(grouped) {
    const keys = [];
    for (const key in grouped) {
        let relationKey = key;
        const childKey = groupToRelation(grouped[key])[0];
        if (childKey) {
            relationKey += '.' + childKey;
        }
        keys.push(relationKey);
    }
    return keys;
}
function hasOwnProperty(obj, prop) {
    return obj.hasOwnProperty(prop);
}
function getName(setting) {
    if (!setting.option) {
        return undefined;
    }
    if (hasOwnProperty(setting.option, 'name')) {
        return setting.option.name;
    }
    return undefined;
}
async function buildEntity(meta, data, reference, options) {
    const groupedRelations = options?.relations ? relationToGroup(options.relations) : {};
    const plain = {};
    for (const relation of Object.keys(groupedRelations)) {
        if (!meta.columns.map(x => x.propertyKey).includes(relation)) {
            throw new RelationNotFoundError(relation);
        }
    }
    for (const setting of meta.columns) {
        let keyInForestore = getName(setting) || setting.propertyKey;
        if (setting instanceof Entity_1._ManyToOneSetting) {
            const relation = groupedRelations[setting.propertyKey];
            if (!relation) {
                continue;
            }
            if (setting.option?.joinColumnName) {
                keyInForestore = setting.option.joinColumnName;
            }
            const rawRef = data[keyInForestore];
            const hierarchy = await followHierarchy({
                setting: setting,
                relations: {
                    top: setting.propertyKey,
                    hierarchy: relation,
                },
                reference: reference,
                fetchMode: {
                    mode: 'ref',
                    reference: rawRef,
                },
            });
            Object.assign(plain, hierarchy);
        }
        else if (setting instanceof Entity_1._OneToManySetting) {
            const relation = groupedRelations[setting.propertyKey];
            if (!relation) {
                continue;
            }
            const hierarchy = await followHierarchy({
                setting: setting,
                relations: {
                    top: setting.propertyKey,
                    hierarchy: relation,
                },
                reference: reference,
                fetchMode: {
                    mode: 'many',
                },
            });
            Object.assign(plain, hierarchy);
        }
        else if (setting instanceof Entity_1._OneToOneSetting) {
            const relation = groupedRelations[setting.propertyKey];
            if (!relation) {
                continue;
            }
            if (setting.option?.joinColumnName) {
                keyInForestore = setting.option.joinColumnName;
                const rawRef = data[keyInForestore];
                const hierarchy = await followHierarchy({
                    setting: setting,
                    relations: {
                        top: setting.propertyKey,
                        hierarchy: relation,
                    },
                    reference: reference,
                    fetchMode: {
                        mode: 'ref',
                        reference: rawRef,
                    },
                });
                Object.assign(plain, hierarchy);
            }
            else if (setting.option?.relationColumn) {
                const hierarchy = await followHierarchy({
                    setting: setting,
                    relations: {
                        top: setting.propertyKey,
                        hierarchy: relation,
                    },
                    reference: reference,
                    fetchMode: {
                        mode: 'single',
                        reference: data[exports.documentReferencePath],
                    },
                });
                Object.assign(plain, hierarchy);
            }
        }
        else if (setting instanceof Entity_1._ArrayReference) {
            const relation = groupedRelations[setting.propertyKey];
            if (!relation) {
                continue;
            }
            const hierarchy = await followHierarchy({
                setting: setting,
                relations: {
                    top: setting.propertyKey,
                    hierarchy: relation,
                },
                reference: reference,
                fetchMode: {
                    mode: 'array',
                    references: data[keyInForestore],
                },
            });
            Object.assign(plain, hierarchy);
        }
        else {
            plain[setting.propertyKey] = data[keyInForestore];
        }
    }
    const instance = new meta.Entity();
    for (const key in plain) {
        instance[key] = plain[key];
    }
    instance[exports.documentReferencePath] = data[exports.documentReferencePath];
    return instance;
}
async function followHierarchy(params) {
    const results = {};
    switch (params.fetchMode.mode) {
        case 'ref':
            const ref = new FirestoreReference(params.fetchMode.reference, params.reference?.transaction);
            const box = await ref.get();
            const unboxed = box.unbox();
            if (unboxed && unboxed[0]) {
                const meta = (0, Entity_1.findMeta)(params.setting.getEntity());
                results[params.setting.propertyKey] = await buildEntity(meta, unboxed[0], ref, {
                    relations: groupToRelation(params.relations.hierarchy || {}),
                });
            }
            break;
        case 'single':
            const singleRef = params.fetchMode.reference;
            const singlRepo = (0, Repository_1.getRepository)(params.setting.getEntity());
            if (params.reference?.transaction) {
                singlRepo.setTransaction(params.reference.transaction);
            }
            results[params.setting.propertyKey] = await singlRepo
                .prepareFetcher(db => {
                return db.where(params.setting.option.relationColumn, '==', singleRef);
            })
                .fetchOne({
                relations: groupToRelation(params.relations.hierarchy || {}),
            });
            break;
        case 'many':
            const manyRepo = (0, Repository_1.getRepository)(params.setting.getEntity());
            if (params.reference?.transaction) {
                manyRepo.setTransaction(params.reference?.transaction);
            }
            results[params.setting.propertyKey] = await manyRepo
                .prepareFetcher(db => {
                return db.where(params.setting.option.relationColumn, '==', params.reference?.ref);
            })
                .fetchAll({
                relations: groupToRelation(params.relations.hierarchy || {}),
            });
            break;
        case 'array':
            const refs = params.fetchMode.references.map(ref => new FirestoreReference(ref, params.reference?.transaction));
            results[params.setting.propertyKey] = await Promise.all(refs.map(ref => {
                return ref.get().then(box => {
                    const unboxed = box.unbox();
                    if (unboxed && unboxed[0]) {
                        const meta = (0, Entity_1.findMeta)(params.setting.getEntity());
                        return buildEntity(meta, unboxed[0], ref, {
                            relations: groupToRelation(params.relations.hierarchy || {}),
                        });
                    }
                    return null;
                });
            }));
            break;
    }
    return results;
}
//# sourceMappingURL=EntityBuilder.js.map