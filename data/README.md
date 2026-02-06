# A3 Data Generation

This directory uses `uv` for managing the Python environment and dependencies. To set up the environment, run:

```bash
uv sync
```

This will install all the necessary packages specified in the `pyproject.toml` file. Once the environment is set up, you can run the data generation scripts as needed.

The data generation script is located in the `scripts` directory. You can run it using the following command:

```bash
uv run -m scripts.generate_data
```

From there, you can copy the generated data to the public folder for our application.

### VSCode Setup

You can also set up VSCode to use the `uv` environment. To do this, open the command palette (Ctrl+Shift+P) and select "Python: Select Interpreter". Then, choose the interpreter from the `.venv` directory in this project.

I usually right click on the `.venv` folder and use "Copy Path" to get the full path to the interpreter. Then I do "Enter interpreter path" and paste it in. This way, VSCode will use the correct environment for running and debugging the code in this directory.