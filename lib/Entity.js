"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports._HookFunction = exports._UpdateDateColumnSetting = exports._CreateDateColumnSetting = exports._ArrayReference = exports._ManyToOneSetting = exports._OneToOneSetting = exports._OneToManySetting = exports._ColumnSetting = exports._PrimaryColumnSetting = void 0;
exports.callHook = callHook;
exports.findMeta = findMeta;
exports.findMetaFromTableName = findMetaFromTableName;
exports.PrimaryColumn = PrimaryColumn;
exports.Column = Column;
exports.OneToMany = OneToMany;
exports.OneToOne = OneToOne;
exports.ManyToOne = ManyToOne;
exports.ArrayReference = ArrayReference;
exports.CreateDateColumn = CreateDateColumn;
exports.UpdateDateColumn = UpdateDateColumn;
exports.BeforeSave = BeforeSave;
exports.AfterSave = AfterSave;
exports.AfterLoad = AfterLoad;
exports.FirebaseEntity = FirebaseEntity;
exports.NestedFirebaseEntity = NestedFirebaseEntity;
require("reflect-metadata");
class _PrimaryColumnSetting {
    propertyKey;
    constructor(propertyKey) {
        this.propertyKey = propertyKey;
    }
}
exports._PrimaryColumnSetting = _PrimaryColumnSetting;
class _ColumnSetting {
    propertyKey;
    columnType;
    option;
    constructor(propertyKey, columnType, option) {
        this.propertyKey = propertyKey;
        this.columnType = columnType;
        this.option = option;
    }
}
exports._ColumnSetting = _ColumnSetting;
class _OneToManySetting {
    propertyKey;
    getEntity;
    option;
    constructor(propertyKey, getEntity, option) {
        this.propertyKey = propertyKey;
        this.getEntity = getEntity;
        this.option = option;
    }
}
exports._OneToManySetting = _OneToManySetting;
class _OneToOneSetting {
    propertyKey;
    getEntity;
    option;
    constructor(propertyKey, getEntity, option) {
        this.propertyKey = propertyKey;
        this.getEntity = getEntity;
        this.option = option;
    }
}
exports._OneToOneSetting = _OneToOneSetting;
class _ManyToOneSetting {
    propertyKey;
    getEntity;
    option;
    constructor(propertyKey, getEntity, option) {
        this.propertyKey = propertyKey;
        this.getEntity = getEntity;
        this.option = option;
    }
}
exports._ManyToOneSetting = _ManyToOneSetting;
class _ArrayReference {
    propertyKey;
    getEntity;
    option;
    constructor(propertyKey, getEntity, option) {
        this.propertyKey = propertyKey;
        this.getEntity = getEntity;
        this.option = option;
    }
}
exports._ArrayReference = _ArrayReference;
class _CreateDateColumnSetting {
    propertyKey;
    constructor(propertyKey) {
        this.propertyKey = propertyKey;
    }
}
exports._CreateDateColumnSetting = _CreateDateColumnSetting;
class _UpdateDateColumnSetting {
    propertyKey;
    constructor(propertyKey) {
        this.propertyKey = propertyKey;
    }
}
exports._UpdateDateColumnSetting = _UpdateDateColumnSetting;
class _HookFunction {
    timing;
    functionName;
    constructor(timing, functionName) {
        this.timing = timing;
        this.functionName = functionName;
    }
}
exports._HookFunction = _HookFunction;
const hookSettings = [];
function addHooks(getEntity, hook) {
    hookSettings.push({ getEntity, hook });
}
function callHook(meta, resource, timing) {
    if (!meta.hooks) {
        return;
    }
    for (const hook of meta.hooks) {
        if (hook.timing === timing) {
            if (resource[hook.functionName]) {
                resource[hook.functionName]();
            }
            break;
        }
    }
}
const entityMetaInfo = [];
const columnSettings = [];
const entityMetaData = {};
const SYMBOL_KEY = Symbol('__firebase_orm_symbol__');
const ENTITY_META_DATA_PROP_KEY = 'entityMetaData';
// having side effects getter
function findMeta(Entity) {
    const meta = Reflect.getMetadata(SYMBOL_KEY, Entity.prototype, ENTITY_META_DATA_PROP_KEY);
    if (meta) {
        return meta;
    }
    const tableInfo = entityMetaInfo.filter(x => x.Entity == Entity)[0];
    const setting = columnSettings
        .map(x => {
        return {
            column: x.column,
            Entity: x.getEntity(),
        };
    })
        .filter(x => x.Entity == Entity);
    const hooks = hookSettings.filter(x => x.getEntity() == Entity).map(x => x.hook);
    const metaData = { ...tableInfo, ...{ columns: setting.map(x => x.column), hooks: hooks } };
    Reflect.defineMetadata(SYMBOL_KEY, metaData, Entity.prototype, ENTITY_META_DATA_PROP_KEY);
    return metaData;
}
function findMetaFromTableName(tableName) {
    const index = entityMetaInfo.findIndex(x => x.tableName == tableName);
    if (index == -1) {
        return null;
    }
    const info = entityMetaInfo[index];
    const meta = Reflect.getMetadata(SYMBOL_KEY, info.Entity.prototype, ENTITY_META_DATA_PROP_KEY);
    if (meta) {
        return meta;
    }
    const setting = columnSettings
        .map(x => {
        return {
            column: x.column,
            Entity: x.getEntity(),
        };
    })
        .filter(x => x.Entity == info.Entity);
    const hooks = hookSettings.filter(x => x.getEntity() == info.Entity).map(x => x.hook);
    const metaData = { ...info, ...{ columns: setting.map(x => x.column), hooks: hooks } };
    Reflect.defineMetadata(SYMBOL_KEY, metaData, info.Entity.prototype, ENTITY_META_DATA_PROP_KEY);
    return metaData;
}
function addColumnSettings(getEntity, setting) {
    columnSettings.push({
        getEntity: getEntity,
        column: setting,
    });
}
function PrimaryColumn() {
    return (target, propertyKey) => {
        addColumnSettings(() => target.constructor, new _PrimaryColumnSetting(propertyKey));
    };
}
function Column(options) {
    return (target, propertyKey) => {
        const ColumnType = Reflect.getMetadata('design:type', target, propertyKey);
        addColumnSettings(() => target.constructor, new _ColumnSetting(propertyKey, ColumnType, options));
    };
}
function OneToMany(getEntity, options) {
    return (target, propertyKey) => {
        addColumnSettings(() => target.constructor, new _OneToManySetting(propertyKey, getEntity, options));
    };
}
function OneToOne(getEntity, options) {
    return (target, propertyKey) => {
        addColumnSettings(() => target.constructor, new _OneToOneSetting(propertyKey, getEntity, options));
    };
}
function ManyToOne(getEntity, options) {
    return (target, propertyKey) => {
        addColumnSettings(() => target.constructor, new _ManyToOneSetting(propertyKey, getEntity, options));
    };
}
function ArrayReference(getEntity, options) {
    return (target, propertyKey) => {
        addColumnSettings(() => target.constructor, new _ArrayReference(propertyKey, getEntity, options));
    };
}
function CreateDateColumn(options) {
    return (target, propertyKey) => {
        addColumnSettings(() => target.constructor, new _CreateDateColumnSetting(propertyKey));
    };
}
function UpdateDateColumn(options) {
    return (target, propertyKey) => {
        addColumnSettings(() => target.constructor, new _UpdateDateColumnSetting(propertyKey));
    };
}
function BeforeSave(options) {
    return (target, propertyKey) => {
        addHooks(() => target.constructor, new _HookFunction('beforeSave', propertyKey));
    };
}
function AfterSave(options) {
    return (target, propertyKey) => {
        addHooks(() => target.constructor, new _HookFunction('afterSave', propertyKey));
    };
}
function AfterLoad(options) {
    return (target, propertyKey) => {
        addHooks(() => target.constructor, new _HookFunction('afterLoad', propertyKey));
    };
}
function FirebaseEntity(tableName) {
    return (constructor) => {
        entityMetaInfo.push({
            tableName: tableName,
            Entity: constructor,
        });
    };
}
// export function NestedFirebaseEntity<T>(parentEntityGetter: () => ClassType<T>, tableName: string) {
//     return (constructor: Function) => {
//         entityMetaInfo.push({
//             tableName: tableName,
//             Entity: constructor,
//             parentEntityGetter: parentEntityGetter
//         });
//     }
// }
function NestedFirebaseEntity(tableName, ...parentEntityGetters) {
    return (constructor) => {
        entityMetaInfo.push({
            tableName: tableName,
            Entity: constructor,
            parentEntityGetters: parentEntityGetters,
        });
    };
}
//# sourceMappingURL=Entity.js.map