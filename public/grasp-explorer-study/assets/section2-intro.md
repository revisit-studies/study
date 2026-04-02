# Section 2: The AI Copilot & Interactive Controls

The Grasp Explorer has an **AI Copilot** that lets you ask natural language questions about grasp planning methods. When you type a query:

1. The system searches a database of **1,074 text chunks from 34 research papers**
2. Methods are re-ranked by relevance to your question
3. The **attribute weights** automatically adjust to emphasize what matters for your query
4. The clustering and scatter plot update accordingly
5. An LLM generates **insight bullets** grounded in actual paper content

## Interactive controls to try

- **Weight sliders** (in the toolbar): Control how much each attribute influences the scatter plot layout. Higher weight = methods that differ on that attribute are pushed further apart. Try dragging a slider and watch the scatter plot reorganize.
- **Color by** dropdown (top right of the scatter plot): Switch the scatter plot coloring from clusters to any attribute — e.g., color by End-effector to see how gripper types distribute across the landscape.
- **Cluster legend** (right side): Click any cluster or attribute value to filter the scatter plot and table.

## What to try

Ask **2-3 questions** that you would genuinely want answered about grasp planning. Being domain experts, we especially want questions where you already know the answer — this lets us check whether the AI gets it right.

Some starting points:

- *"How do point cloud methods compare to depth image approaches for cluttered bin picking?"*
- *"What neural network architectures are used across grasp planning methods?"*
- *"Which methods handle sim-to-real transfer?"*

After asking a query, **scroll down** to see the analytics section with charts showing query-method similarity, cited references, key topics, and evidence breakdown. These help you understand how the AI arrived at its answer.

## View the source PDFs (work in progress)

After asking a query, look for the **Paper Evidence** section below the insight bullets. Each paper listed has a **"View PDF"** button on the right side. This feature is **still being developed** — highlighting may show irrelevant terms or not work at all. We are sharing it early to get your feedback on the concept: **does having direct access to the cited paper passage help you trust or verify the AI's claims?**

## Papers in the knowledge base

The AI can cite content from these 34 papers: 3DAPNet, AnyGrasp, CaTGrasp, Contact-GraspNet, DexDiffuser, DexGrasp Anything, Edge Grasp Network, Equivariant Volumetric Grasping, FoundationGrasp, GCNGrasp, GeomPickPlace, GA-DDPG, GIGA, GPD, GraspGen, GraspGPT, GraspMolmo, GraspQP, GraspSAM, GraspVLA, GraspXL, Multi-FinGAN, NeuGraspNet, OrbitGrasp, PointNetGPD, REGNet, RGBD-Grasp, Robust Grasp Planning, RobustDexGrasp, ShapeGrasp, S4G, UniGraspTransformer, VGN, ZeroGrasp.

## Heads up: what we will ask after you explore

You will answer some questions with the tool still visible, and some without. Keep these in mind:

- Were the AI insights relevant, accurate, and novel?
- Did you notice anything incorrect or fabricated?
- Did paper citations help you trust the claims?
- Did the weight sliders and color-by controls help you explore?
- Were the analytics charts (similarity scores, evidence breakdown) useful?
- What guardrails would you expect from an AI research tool?

## Think aloud

Please **speak your thoughts** as you explore. Tell us what you find useful, what confuses you, and whether the tool helps you gain insights you wouldn't get from reading the papers individually.

Click **Next** to try the AI Copilot.
