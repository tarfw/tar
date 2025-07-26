// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react-native";

const _schema = i.schema({
  entities: {
    items: i.entity({
      titles: i.string().optional(),
    }),
    peoples: i.entity({
      profile: i.any().optional(),
      status: i.any().optional(),
      title: i.any().optional(),
    }),
    products: i.entity({
      title: i.string().optional(),
    }),
    sales: i.entity({
      title: i.string().optional(),
    }),
    spaces: i.entity({
      title: i.string().optional(),
    }),
    tasks: i.entity({
      createdat: i.date().optional(),
      status: i.string().optional(),
      title: i.string().optional(),
    }),
  },
  links: {},
  rooms: {},
});

// This helps Typescript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema {}
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;
