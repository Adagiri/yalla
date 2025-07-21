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
this call should run independently on it own
      await SubscriptionService.publishNewTripRequest(driverIds, {
        id: trip._id,
        pickup: trip.pickup,
        destination: trip.destination,
        customer: customer,
        pricing: trip.pricing,
        estimatedArrival: trip.estimatedArrival,
      });


for trip accepted subscription, we need to make sure that drivers who were informed of the trip availability are informed of the trip token.

what if finding drivers found no drivers for a long time, what happens?, what logic can we add?

