# How the Grasp Explorer Works

The Grasp Explorer is a dashboard that visualizes **56 robotic grasp planning methods** and lets you ask natural language questions about them.

## What happens when you ask a question

1. Your question is converted into a numerical vector and compared against all 56 method descriptions to find the most relevant ones
2. A vector database of **1,074 text chunks from 34 research papers** is searched for passages relevant to your question
3. The visualization is re-clustered using HDBSCAN (a density-based clustering algorithm) with column weights adjusted based on your query
4. An LLM generates insights grounded in the actual paper content and clustering results

## What you see on the dashboard

- **Scatter plot**: Each dot is a grasp planning method, positioned by similarity (nearby dots = similar methods)
- **Cluster colors**: Methods are grouped into natural clusters based on shared attributes
- **AI Copilot Insight**: Bullet-point analysis citing specific papers
- **Paper Evidence**: Links to the source papers with a built-in PDF viewer
- **Analytics charts**: Method relevance scores, topic distributions, and evidence breakdowns

## Papers available in the knowledge base

The tool has indexed the following **34 papers**. Your questions will be most effective when they relate to topics covered by these methods:

| # | Method | # | Method |
|---|--------|---|--------|
| 1 | 3DAPNet | 18 | GraspQP |
| 2 | AnyGrasp | 19 | GraspSAM |
| 3 | CaTGrasp | 20 | GraspVLA |
| 4 | Contact-GraspNet | 21 | GraspXL |
| 5 | DexDiffuser | 22 | Multi-FinGAN |
| 6 | DexGrasp Anything | 23 | NeuGraspNet |
| 7 | Edge Grasp Network | 24 | OrbitGrasp (EquiFormerV2) |
| 8 | Equivariant Volumetric Grasping | 25 | PointNetGPD |
| 9 | FoundationGrasp | 26 | REGNet |
| 10 | GCNGrasp | 27 | RGBD-Grasp |
| 11 | GeomPickPlace | 28 | Robust Grasp Planning Over Uncertain Shape Completions |
| 12 | GA-DDPG | 29 | RobustDexGrasp |
| 13 | GIGA | 30 | ShapeGrasp |
| 14 | Grasp Pose Detection (GPD) | 31 | S4G |
| 15 | GraspGen | 32 | UniGraspTransformer |
| 16 | GraspGPT | 33 | VGN |
| 17 | GraspMolmo | 34 | ZeroGrasp |

The dataset also includes **22 additional methods** without indexed papers (e.g., Dex-Net series, GGCNN, UniGrasp). These appear in the visualization but the AI cannot cite their paper content.

Click **Next** to start exploring the tool.
