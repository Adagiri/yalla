1. On resetting password, make sure to check for old passwords and add new password to the list of old passwords

# Tasks
trip type
 - within estate
 - outside estate

saved locations

- Pin for customers

Payments:
Payment integration
Real time system integration



=====================================================================

1.
in audit-log.service file, I get this type error here:

sessionId: input.request?.sessionID,

Property 'sessionID' does not exist on type 'Request<ParamsDictionary, any, any, ParsedQs, Record<string, any>>'.

2. 

Get this type error too:

'mongoose.connection.db' is possibly 'undefined'.

in file:

system-monitoring-service.ts

in this place:  const dbStats = await mongoose.connection.db.stats();

3. 

In admin-auth.service.ts file, I get this type error:

The operand of a 'delete' operator must be optional.ts(2790)

(property) AdminModelType.password: string

at this place of the code: delete adminResponse.password;

4. 

