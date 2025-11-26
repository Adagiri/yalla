const {
  DateScalar,
  TimeScalar,
  DateTimeScalar,
} = require('graphql-date-scalars');
const defaultResolvers = {
  DateTime: DateTimeScalar,
  Date: DateScalar,
  Time: TimeScalar,
//   Query: {},
//   Mutation: {},
};

export default defaultResolvers