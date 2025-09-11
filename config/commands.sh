aws apprunner update-service \
  --service-arn "arn:aws:apprunner:us-east-1:051259970704:service/yalla-service/ca586ea31789414f9327b699cbb63c71" \
  --source-configuration '{
    "CodeRepository": {
      "RepositoryUrl": "https://github.com/Yalla-WorkSpace/yalla-ride",
      "SourceCodeVersion": {
        "Type": "BRANCH",
        "Value": "main"
      },
      "CodeConfiguration": {
        "ConfigurationSource": "API",
        "CodeConfigurationValues": {
          "Runtime": "NODEJS_18",
          "BuildCommand": "npm install",
          "StartCommand": "npm start",
          "Port": "3000",
          "RuntimeEnvironmentVariables": {
            "MONGO_URI": "mongodb+srv://adagiri:Ridwanullah477@qdb-krowdee.qt3cr.mongodb.net/yalla-ride",
            "JWT_SECRET_KEY": "1234567890plmnbvcxzaqwertyuio09876lkjhgfdsa12345zxcvbnm",
            "ENCRYPTION_KEY": "abcdefghijklmnopqrstuvwx1234567890",
            "INVOICE_WEBHOOK_KEY": "0987654321qwertmlkdidor0294y7reyfq3r7i8f2y7irfgr4bf",
            "YALLA_APP_HOSTNAME": "app.yalla.ng",
            "AWS_ACCESS_KEY_ID": "AKIAQX32VCSIE4PFXLVN",
            "AWS_SECRET_ACCESS_KEY": "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",
            "AWS_SES_REGION": "us-east-1",
            "AWS_SES_FROM_EMAIL": "hello@yalla.ng",
            "AWS_S3_REGION": "us-east-1",
            "AWS_S3_ASSET_BUCKET": "yalla-images",
            "AWS_S3_ASSET_HOSTNAME": "https://assets.yalla.ng",
            "AWS_LOCATION_REGION": "us-east-1",
            "AWS_LOCATION_MAP_NAME": "YallaMap",
            "AWS_LOCATION_PLACE_INDEX_NAME": "YallaPlaceIndex",
            "AWS_LOCATION_ROUTE_CALCULATOR_NAME": "YallaRouteCalculator",
            "AWS_LOCATION_GEOFENCE_COLLECTION_NAME": "YallaGeofences",
            "AWS_LOCATION_TRACKER_NAME": "YallaDriverTracker",
            "REDIS_URL": "redis://localhost:6379",
            "REDIS_HOST": "localhost",
            "REDIS_PORT": "6379",
            "REDIS_PASSWORD": "",
            "FIREBASE_PROJECT_ID": "112438400847243997582",
            "FIREBASE_CLIENT_EMAIL": "firebase-adminsdk-2fn5k@yalla-d3bb6.iam.gserviceaccount.com",
            "FIREBASE_PRIVATE_KEY_IN_BASE_64": "-----BEGIN PRIVATE KEY-----\\nMIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCrvc9DrSUMFRjz\\nK1XYv8qMeJsbEZUcIhcSxjk1grNmMkZlSNNW4ipjjgJQ28/H7ViOPRdPAqmCqd6/\\n3YQllrRIn4r73+WLiw3nzknXM264QjY6VHWL4co3h7BgssZpQ+oUVOhFNmwte3f7\\nYMmuWmDZl8SwwMHvqIp77IwK68CJdLtwrGahtZH7s6iVTtaXmzaGJJW+lcbYfwJW\\nNgO/OPiTZS9sOzXpOewxihH92FZ9CKna7v82uXZBIZhMBQitp72ZGOAA5qrj+mD+\\nDxZB6z20OtKHAJbEGm30e6XV6CjbH1IoAv1HT5sl5/CBm+a+O4J5m/f0PnUXe5j4\\nXiOLq83JAgMBAAECggEAC60a81Hz69oKA+EACX14oDZEQqyJA7b5n0gkyZOPmN91\\nfnCwwFPIvVNWqvgBghPhP8JoMZylDld4PSPVVoI5fZqDO36hv5ao+l1Bve98PpYZ\\n07tm8SddCot0yA4/g8FJ9S8/ShKve3l30yUQcS8p2IFYrl+x5RZYsUuIIJHzWXpJ\\nYzkXICet6MoLo6b6udObn3TCGWfnLYNhi7AhN9eoiSV+iI8LkpkrQOXPunUHACG5\\nuPTMEBKj+5gDfj8fEDxqGSWy/Msi1ONPpEaxLIAdSquotWncMkZchqvPsDcJ7ZjJ\\nTampsfqWYJNEybsZdCT5laRCN5nl9aVDMJKqJ2yFxQKBgQDWjjy6+ib7XiIraXBq\\nqsPqOXIfQj6dvf3lCq3mANqzJFlip1IvgfjiViqjq88h5upI7HXHWPKAn8zG3Tnp\\neg/N1+UuNLM87jqNCRfAYDHHmF8Heai7WDO0oryHcz4e/1Iau71gxubs1t4aUyDe\\ntJ9SRFbWV7E5/Muor2BRg+V4ZwKBgQDM6moFGQXD66bz1Ul6CCudtaU3XyJTcWuz\\nE3luqTGRl4frwOS6PRPs/deNaEQSBxc+UtsQGIhF4Zq8Wd0bSxCrHwmXaqxzfk+9\\nw8P7tGoNK5DUvRp6t5NeRUJrvMTrUEKQeK8ire9uN88FLgId0W7Qgp0Guw25rzvZ\\nz4B4L1dqTwKBgHHh+bY9RSezZWupgbP8hBT0/PA+l0HfML68FmW5Glxv9Mn6ihMR\\nZ+urVOKfNUiHat/eMv3m5oEDUQxVLIIS+gSGje0ip+i1gnqN0v+Xj5Sj+fzbxIX8\\nYSWGI4+5ycVmPExYTkLqEHSx8B4E9bOAJ/jgsT8AON/QoMEepX9fBRQNAoGAF2NJ\\n5nsMpWfoDjxxvnPgRofM65z4Ff4EBNRcL70v4yYgZVAGyxrdg1cVmxYjbstQY9Sh\\nHB0wsIknWAgJrGvM4zsPpTCPrj7kawxE+h2FXStzxFQxCYCaWVAeXJ2W/CSU9FhR\\n5OtlQHcuMbEmnLCirTm7ImGHF4JgmmOMjisZFxECgYBpWJqh/NBuc0oHP/L8q+Vp\\n4Ql7ifra5uNCMWEgre9fjubchqXPKSirEstYh3PZtI8KJneXw8LYjo5sQeKX/QT9\\nLCmjR1Jp1omxtw8OTjz0kdHO7jklvJ0H20zQLR5sZQ1F73PQQd/OVbGxuZztFjm+\\nBXh44mYs+NoypwW+pWWmZg==\\n-----END PRIVATE KEY-----\\n",
            "ALLOWED_ORIGINS": "http://localhost:3000,http://localhost:4000",
            "PAYSTACK_BANK_TRANSFER_PAYMENT_METHOD": "bank_transfer",
            "PAYSTACK_BASE_URL": "https://api.paystack.co",
            "PAYSTACK_CARD_PAYMENT_METHOD": "card",
            "PAYSTACK_PUBLIC_KEY": "pk_test_12ea7efac68d34f75e4254d881b554a5412e477d",
            "PAYSTACK_SECRET_KEY": "sk_test_c39ca5b0575ed9a4c1ee4def77df81791a301cfb",
            "PAYSTACK_AUTH_CODE_ENCRYPTION_KEY": "ogezitaporpkcatsyap09876543216789054321",
            "GOOGLE_API_KEY": "AIzaSyAXkb9nF3d9HPzcoPw_mpbok7_p3v0eAEw",
            "TERMII_BASE_URL": "https://v3.api.termii.com",
            "TERMII_SENDER_ID": "N-Alert",
            "TERMII_API_KEY": "TLouKgTqSeoiNjbqpAOKddvlameIDjPjlbKbvwPoZJtVxyIfnQRIZtExECfrDT"
          }
        }
      }
    }
  }' \
  --profile yalla