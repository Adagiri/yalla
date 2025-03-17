import path from 'path';
import { makeExecutableSchema } from '@graphql-tools/schema';
import { loadFilesSync } from '@graphql-tools/load-files';

const typesArray = loadFilesSync(path.join(__dirname, '..', '**/*.gql'));
const resolversArray = loadFilesSync(
  path.join(__dirname, '..', '**/*.resolver.{js,ts}')
);

const schema = makeExecutableSchema({
  typeDefs: typesArray,
  resolvers: resolversArray,
});

export default schema;