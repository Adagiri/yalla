import { GraphQLJSON } from 'graphql-scalars';

const {
  DateScalar,
  TimeScalar,
  DateTimeScalar,
} = require('graphql-date-scalars');
const defaultResolvers = {
  DateTime: DateTimeScalar,
  Date: DateScalar,
  Time: TimeScalar,
  JSON: GraphQLJSON,
  //   Query: {},
  //   Mutation: {},
};

export default defaultResolvers;
