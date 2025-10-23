// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react-native";

const _schema = i.schema({
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
      imageURL: i.string().optional(),
      type: i.string().optional(),
    }),
    address: i.entity({
      city: i.string().optional(),
      country: i.string().optional(),
      line: i.string().optional(),
      name: i.string().optional(),
      phone: i.string().optional(),
      pincode: i.number().optional(),
      state: i.string().optional(),
    }),
    customers: i.entity({
      email: i.string().optional(),
      name: i.string().indexed().optional(),
      phone: i.number().optional(),
    }),
    discounts: i.entity({
      appliesto: i.string().optional(),
      code: i.string().optional(),
      endat: i.date().optional(),
      startat: i.date().optional(),
      type: i.string().optional(),
      value: i.number().optional(),
    }),
    inventory: i.entity({
      available: i.number().optional(),
      committed: i.number().optional(),
      incoming: i.number().optional(),
      updatedat: i.date().optional(),
    }),
    items: i.entity({
      barcode: i.string().optional(),
      cost: i.number().optional(),
      image: i.string().optional(),
      op1: i.string().optional(),
      op2: i.string().optional(),
      op3: i.string().optional(),
      price: i.number().optional(),
      sku: i.string().indexed().optional(),
    }),
    locations: i.entity({
      name: i.string().indexed().optional(),
    }),
    logs: i.entity({
      actor: i.any().optional(),
      details: i.any().optional(),
      entity: i.string().optional(),
      location: i.string().optional(),
      timestamp: i.date().optional(),
    }),
    orderlines: i.entity({
      discount: i.number().optional(),
      price: i.number().optional(),
      qty: i.number().optional(),
      tax: i.number().optional(),
    }),
    orders: i.entity({
      createdat: i.date().indexed().optional(),
      disctotal: i.number().optional(),
      fullstatus: i.string().optional(),
      paystatus: i.string().optional(),
      subtotal: i.number().optional(),
      tax: i.number().optional(),
      total: i.number().optional(),
    }),
    payments: i.entity({
      amount: i.number().optional(),
      method: i.string().optional(),
      processat: i.date().optional(),
      status: i.string().optional(),
      transaction: i.string().optional(),
    }),
    products: i.entity({
      img: i.string().optional(),
      medias: i.string().optional(),
      notes: i.string().optional(),
      status: i.string().optional(),
      title: i.string().indexed().optional(),
      type: i.string().optional(),
      vendor: i.string().optional(),
    }),
    stores: i.entity({
      currency: i.string().optional(),
      domain: i.string().unique().optional(),
      name: i.string().indexed().optional(),
      subdomain: i.string().unique().optional(),
      timezone: i.string().optional(),
    }),
    tasks: i.entity({
      note: i.string().optional(),
      status: i.string().optional(),
      title: i.string(),
    }),
    teams: i.entity({}),
  },
  links: {
    $usersLinkedPrimaryUser: {
      forward: {
        on: "$users",
        has: "one",
        label: "linkedPrimaryUser",
        onDelete: "cascade",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "linkedGuestUsers",
      },
    },
    customersAddress: {
      forward: {
        on: "customers",
        has: "one",
        label: "address",
      },
      reverse: {
        on: "address",
        has: "one",
        label: "customers",
        onDelete: "cascade",
      },
    },
    customersStores: {
      forward: {
        on: "customers",
        has: "many",
        label: "stores",
      },
      reverse: {
        on: "stores",
        has: "many",
        label: "customers",
      },
    },
    discountsStores: {
      forward: {
        on: "discounts",
        has: "one",
        label: "stores",
      },
      reverse: {
        on: "stores",
        has: "many",
        label: "discounts",
      },
    },
    inventoryItem: {
      forward: {
        on: "inventory",
        has: "one",
        label: "item",
      },
      reverse: {
        on: "items",
        has: "many",
        label: "inventory",
      },
    },
    inventoryLocations: {
      forward: {
        on: "inventory",
        has: "many",
        label: "locations",
      },
      reverse: {
        on: "locations",
        has: "many",
        label: "inventory",
      },
    },
    itemsProduct: {
      forward: {
        on: "items",
        has: "one",
        label: "product",
      },
      reverse: {
        on: "products",
        has: "many",
        label: "items",
      },
    },
    locationsStores: {
      forward: {
        on: "locations",
        has: "one",
        label: "stores",
      },
      reverse: {
        on: "stores",
        has: "many",
        label: "locations",
      },
    },
    orderlinesItems: {
      forward: {
        on: "orderlines",
        has: "one",
        label: "items",
      },
      reverse: {
        on: "items",
        has: "many",
        label: "orderlines",
      },
    },
    orderlinesOrders: {
      forward: {
        on: "orderlines",
        has: "one",
        label: "orders",
      },
      reverse: {
        on: "orders",
        has: "many",
        label: "orderlines",
      },
    },
    paymentsOrders: {
      forward: {
        on: "payments",
        has: "one",
        label: "orders",
      },
      reverse: {
        on: "orders",
        has: "many",
        label: "payments",
      },
    },
    productsStore: {
      forward: {
        on: "products",
        has: "many",
        label: "store",
      },
      reverse: {
        on: "stores",
        has: "many",
        label: "products",
      },
    },
    stores$users: {
      forward: {
        on: "stores",
        has: "many",
        label: "$users",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "stores",
      },
    },
    storesAddress: {
      forward: {
        on: "stores",
        has: "one",
        label: "address",
      },
      reverse: {
        on: "address",
        has: "one",
        label: "stores",
        onDelete: "cascade",
      },
    },
    tasks$creator: {
      forward: {
        on: "tasks",
        has: "many",
        label: "$creator",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "creator",
      },
    },
    tasks$doer: {
      forward: {
        on: "tasks",
        has: "many",
        label: "$doer",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "doer",
      },
    },
    teams$users: {
      forward: {
        on: "teams",
        has: "many",
        label: "$users",
      },
      reverse: {
        on: "$users",
        has: "many",
        label: "teams",
      },
    },
    teamsStores: {
      forward: {
        on: "teams",
        has: "many",
        label: "stores",
      },
      reverse: {
        on: "stores",
        has: "many",
        label: "teams",
      },
    },
  },
  rooms: {},
});

// This helps Typescript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
