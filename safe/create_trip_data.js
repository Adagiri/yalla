// // Ready-to-use GraphQL mutations for testing trip creation around Gwarimpa

// // ===== QUICK TEST TRIPS =====

// // Trip 1: Short trip within Gwarimpa area
// const shortTrip = {
//   input: {
//     pickup: {
//       address: "Block 15, Gwarimpa Estate Phase 1, Abuja",
//       coordinates: {
//         coordinates: [7.4951, 9.1579]
//       }
//     },
//     destination: {
//       address: "Gwarimpa Shopping Mall, Gwarimpa Estate, Abuja", 
//       coordinates: {
//         coordinates: [7.4940, 9.1570]
//       }
//     },
//     paymentMethod: "cash",
//     priceOffered: 1000
//   }
// };

// // Trip 2: Medium trip to business area
// const mediumTrip = {
//   input: {
//     pickup: {
//       address: "Gwarimpa Estate Phase 2, Behind Living Faith Church, Abuja",
//       coordinates: {
//         coordinates: [7.4965, 9.1590]
//       }
//     },
//     destination: {
//       address: "Wuse 2 Central Business District, Abuja",
//       coordinates: {
//         coordinates: [7.4898, 9.0579]
//       }
//     },
//     paymentMethod: "card",
//     priceOffered: 2800
//   }
// };

// // Trip 3: Long trip to airport
// const longTrip = {
//   input: {
//     pickup: {
//       address: "Gwarimpa Extension, Near Sun City Plaza, Abuja",
//       coordinates: {
//         coordinates: [7.4930, 9.1560]
//       }
//     },
//     destination: {
//       address: "Nnamdi Azikiwe International Airport, Abuja",
//       coordinates: {
//         coordinates: [7.2631, 9.0068]
//       }
//     },
//     paymentMethod: "wallet",
//     priceOffered: 9500
//   }
// };

// // Trip 4: Reverse trip (popular destination to Gwarimpa)
// const reverseTrip = {
//   input: {
//     pickup: {
//       address: "Transcorp Hilton Hotel, Maitama District, Abuja",
//       coordinates: {
//         coordinates: [7.4951, 9.0820]
//       }
//     },
//     destination: {
//       address: "Gwarimpa Estate Phase 1, Block 22, Abuja",
//       coordinates: {
//         coordinates: [7.4955, 9.1582]
//       }
//     },
//     paymentMethod: "cash"
//     // No priceOffered - let system calculate automatically
//   }
// };

// // ===== GRAPHQL MUTATION =====
// const CREATE_TRIP_MUTATION = `
//   mutation CreateTrip($input: CreateTripInput!) {
//     createTrip(input: $input) {
//       id
//       tripNumber
//       status
//       pickup {
//         address
//         location {
//           coordinates
//         }
//       }
//       destination {
//         address
//         location {
//           coordinates
//         }
//       }
//       pricing {
//         baseAmount
//         finalAmount
//         currency
//         surgeMultiplier
//         breakdown {
//           baseFare
//           distanceCharge
//           timeCharge
//           surgeFee
//           discount
//         }
//       }
//       paymentMethod
//       paymentStatus
//       requestedAt
//       estimatedArrival
//       verificationPin
//     }
//   }
// `;

// // ===== TRIP ESTIMATE QUERY (Optional - to check pricing first) =====
// const GET_TRIP_ESTIMATE = `
//   query GetTripEstimate($input: TripEstimateInput!) {
//     getTripEstimate(input: $input) {
//       distance
//       duration
//       pricing {
//         baseAmount
//         finalAmount
//         currency
//         breakdown {
//           baseFare
//           distanceCharge
//           timeCharge
//           surgeFee
//         }
//       }
//       surgeActive
//       surgeMultiplier
//       estimatedArrival
//       polyline
//     }
//   }
// `;

// // ===== USAGE EXAMPLES =====

// // Example 1: Test trip creation flow
// const testTripCreation = async (apolloClient) => {
//   try {
//     console.log('🚗 Creating test trip...');
    
//     const { data } = await apolloClient.mutate({
//       mutation: gql(CREATE_TRIP_MUTATION),
//       variables: shortTrip
//     });
    
//     console.log('✅ Trip created:', {
//       id: data.createTrip.id,
//       tripNumber: data.createTrip.tripNumber,
//       status: data.createTrip.status,
//       estimatedPrice: data.createTrip.pricing.finalAmount
//     });
    
//     return data.createTrip;
//   } catch (error) {
//     console.error('❌ Trip creation failed:', error);
//     throw error;
//   }
// };

// // Example 2: Test background runner flow
// const testBackgroundRunnerFlow = async (apolloClient) => {
//   console.log('🔄 Testing complete background runner flow...');
  
//   // Step 1: Create trip (should have status "searching")
//   const trip = await apolloClient.mutate({
//     mutation: gql(CREATE_TRIP_MUTATION),
//     variables: mediumTrip
//   });
  
//   console.log(`📍 Trip created with status: ${trip.data.createTrip.status}`);
  
//   // Step 2: Wait for background runner (10 seconds + processing time)
//   console.log('⏳ Waiting for background runner to process...');
//   await new Promise(resolve => setTimeout(resolve, 15000));
  
//   // Step 3: Query trip to see if status changed to "drivers_found"
//   const updatedTrip = await apolloClient.query({
//     query: gql(`
//       query GetTrip($id: ID!) {
//         getTrip(id: $id) {
//           id
//           status
//           driversNotified
//           driversFoundAt
//         }
//       }
//     `),
//     variables: { id: trip.data.createTrip.id }
//   });
  
//   console.log('📊 Trip status update:', updatedTrip.data.getTrip);
  
//   return updatedTrip.data.getTrip;
// };

// // Example 3: Bulk trip creation for testing
// const createBulkTestTrips = async (apolloClient, count = 5) => {
//   console.log(`🚚 Creating ${count} test trips...`);
  
//   const trips = [shortTrip, mediumTrip, longTrip, reverseTrip];
//   const results = [];
  
//   for (let i = 0; i < count; i++) {
//     const tripInput = trips[i % trips.length];
    
//     try {
//       const { data } = await apolloClient.mutate({
//         mutation: gql(CREATE_TRIP_MUTATION),
//         variables: tripInput
//       });
      
//       results.push(data.createTrip);
//       console.log(`✅ Trip ${i + 1} created: ${data.createTrip.tripNumber}`);
      
//       // Small delay to avoid overwhelming the system
//       await new Promise(resolve => setTimeout(resolve, 1000));
      
//     } catch (error) {
//       console.error(`❌ Trip ${i + 1} failed:`, error.message);
//     }
//   }
  
//   return results;
// };

// // ===== CURL EXAMPLES =====

// // Quick curl command for testing
// const curlExample = `
// curl -X POST http://localhost:8000/graphql \\
//   -H "Content-Type: application/json" \\
//   -H "Authorization: Bearer YOUR_CUSTOMER_TOKEN" \\
//   -d '{
//     "query": "mutation CreateTrip($input: CreateTripInput!) { createTrip(input: $input) { id tripNumber status pricing { finalAmount } } }",
//     "variables": {
//       "input": {
//         "pickup": {
//           "address": "Block 15, Gwarimpa Estate Phase 1, Abuja",
//           "coordinates": { "coordinates": [7.4951, 9.1579] }
//         },
//         "destination": {
//           "address": "Wuse 2 Market, Abuja", 
//           "coordinates": { "coordinates": [7.4898, 9.0579] }
//         },
//         "paymentMethod": "cash",
//         "priceOffered": 2500
//       }
//     }
//   }'
// `;

// // ===== COORDINATE REFERENCE =====
// const gwarimpaCoordinates = {
//   // Main pickup points
//   gwarimpaPhase1: [7.4951, 9.1579],
//   gwarimpaPhase2: [7.4965, 9.1590], 
//   gwarimpaExtension: [7.4930, 9.1560],
//   gwarimpaShoppingMall: [7.4940, 9.1570],
  
//   // Popular destinations
//   wuse2: [7.4898, 9.0579],
//   maitama: [7.4951, 9.0820],
//   airport: [7.2631, 9.0068],
//   nationalAssembly: [7.4951, 9.0765],
//   universityOfAbuja: [7.0833, 8.9167],
  
//   // Nearby areas
//   dawaki: [7.4723, 9.1234],
//   kubwa: [7.3420, 9.0234],
//   lokogoma: [7.5123, 9.1345]
// };

// // Export for testing
// module.exports = {
//   tripInputs: {
//     shortTrip,
//     mediumTrip, 
//     longTrip,
//     reverseTrip
//   },
//   mutations: {
//     CREATE_TRIP_MUTATION,
//     GET_TRIP_ESTIMATE
//   },
//   testFunctions: {
//     testTripCreation,
//     testBackgroundRunnerFlow,
//     createBulkTestTrips
//   },
//   gwarimpaCoordinates,
//   curlExample
// };

// // ===== TESTING CHECKLIST =====
// /*
// Background Runner Testing Checklist:

// 1. ✅ Create trip → Status should be "searching"
// 2. ✅ Wait 10 seconds → Background runner should process
// 3. ✅ Check Redis → Incoming trips should be created for nearby drivers  
// 4. ✅ Trip status → Should change to "drivers_found"
// 5. ✅ Driver acceptance → Status should change to "driver_assigned"
// 6. ✅ Cleanup test → After 60 seconds, unaccepted trips reset to "searching"

// Use the testBackgroundRunnerFlow() function to test the complete flow!
// */