import json
import random
import pandas as pd

def generate_experiment_data(num_trials=200, num_points=10):
    experiment_data = []

    for trial in range(num_trials):
        # Generate a list of random values between 0 and 100
        data_points = [random.randint(0, 100) for _ in range(num_points)]
        data_points.sort()  

        # Randomly select two data points for comparison
        idx1, idx2 = random.sample(range(num_points), 2)
        smaller, larger = sorted([data_points[idx1], data_points[idx2]])

        # Calculate the actual percentage
        true_percentage = round((smaller / larger) * 100, 2)

        trial_data = {
            "trial_id": trial + 1,
            "data_points": data_points,
            "marked_indices": [idx1, idx2],
            "true_percentage": true_percentage
        }

        experiment_data.append(trial_data)

    return experiment_data

# Generate data
data = generate_experiment_data()

# Save as JSON for use in D3
with open("experiment_data.json", "w") as f:
    json.dump(data, f, indent=4)

# Optionally save as CSV
df = pd.DataFrame(data)
df.to_csv("experiment_data.csv", index=False)

print("Data generation complete. Files saved as JSON and CSV.")

