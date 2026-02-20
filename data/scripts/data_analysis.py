import numpy as np
import pandas as pd
from statsmodels.genmod.bayes_mixed_glm import BinomialBayesMixedGLM
import matplotlib.pyplot as plt
import seaborn as sns

def load_data():
    df = pd.read_csv("../clean_data.csv")

    # convert to categorical and bool
    df["chart_type"] = df["chart_type"].astype("category")
    df["permuted"] = df["permuted"].astype("category")
    df["is_correct"] = df["is_correct"].astype(int)

    return df

def mixed_logistical_regression(df):
    # create dummy variables automatically
    formula = "is_correct ~ chart_type * permuted"

    # random intercepts for participant and stimulus
    vcf = {
        "participant": "0 + C(participant_id)",
        "trial": "0 + C(trial_id)"
    }

    model = BinomialBayesMixedGLM.from_formula(formula, vcf, df)
    result = model.fit_vb()

    print(result.summary())
    return result

# log-odds to probability
def logit_to_prob(logit):
    return np.exp(logit) / (1 + np.exp(logit))

def predict_condition(include_terms, coef_mean, coef_sd):
    logit_mean = sum(coef_mean[t] for t in include_terms)

    # approx variance (assuming independence)
    logit_var = sum(coef_sd[t]**2 for t in include_terms)
    logit_sd = np.sqrt(logit_var)

    p = logit_to_prob(logit_mean)

    # delta method for SD in probability space
    sd_p = p * (1 - p) * logit_sd

    return p, sd_p

def report_table(result):
    fe_means = result.fe_mean
    fe_sds = result.fe_sd
    fe_names = result.model.exog_names

    coef_mean = dict(zip(fe_names, fe_means))
    coef_sd = dict(zip(fe_names, fe_sds))

    conditions = [
        ("colorfield", "ordered",
         ["Intercept"]),

        ("colorfield", "permuted",
         ["Intercept",
          "permuted[T.permuted]"]),

        ("line chart", "ordered",
         ["Intercept",
          "chart_type[T.line chart]"]),

        ("line chart", "permuted",
         ["Intercept",
          "chart_type[T.line chart]",
          "permuted[T.permuted]",
          "chart_type[T.line chart]:permuted[T.permuted]"])
    ]

    table = []
    for chart, perm, terms in conditions:
        p, sd = predict_condition(terms, coef_mean, coef_sd)
        table.append({
            "chart_type": chart,
            "permuted": perm,
            "predicted_probability": p,
            "sd_probability": sd
        })
    table = pd.DataFrame(table)

    table["predicted_probability"] = table["predicted_probability"].round(3)
    table["sd_probability"] = table["sd_probability"].round(3)
    print(table)
    return table


def compute_empirical_means(df):
    return (
        df.groupby(["chart_type", "permuted"], observed=True)["is_correct"]
        .mean()
        .reset_index()
        .rename(columns={"is_correct": "mean_accuracy"})
    )

def cluster_bootstrap_accuracy(df, n_boot=5000):
    participants = df["participant_id"].unique()
    boot_results = []

    for _ in range(n_boot):
        sampled_ids = np.random.choice(
            participants,
            size=len(participants),
            replace=True
        )

        sampled_df = pd.concat([df[df["participant_id"] == pid] for pid in sampled_ids])

        means = (
            sampled_df
            .groupby(["chart_type", "permuted"], observed=True)["is_correct"]
            .mean()
            .reset_index()
        )

        boot_results.append(means)

    boot_df = pd.concat(boot_results, keys=range(n_boot))

    ci_df = (
        boot_df
        .groupby(["chart_type", "permuted"], observed=True)["is_correct"]
        .quantile([0.025, 0.975])
        .unstack()
        .reset_index()
        .rename(columns={0.025: "ci_lower", 0.975: "ci_upper"})
    )
    return ci_df

# bootstrapped 95% CI of accuracy per condition using participant-level resampling
def compute_bootstrap_summary(df, n_boot=5000):
    mean_df = compute_empirical_means(df)
    ci_df = cluster_bootstrap_accuracy(df, n_boot)

    summary = mean_df.merge(ci_df, on=["chart_type", "permuted"])
    print(summary)
    return summary


def plot_accuracy_bars(summary_df, show_model=True):
    plt.figure(figsize=(8,6))
    
    # plot empirical bootstrapped mean accuracy
    sns.barplot(
        data=summary_df,
        x='chart_type',
        y='mean_accuracy',
        hue='permuted',
        ci=None,
        palette='muted'
    )
    
    # add empirical bootstrapped CIs as error bars
    for i, row in summary_df.iterrows():
        x_pos = list(summary_df['chart_type'].unique()).index(row['chart_type'])
        hue_offset = -0.2 if row['permuted'] == 'ordered' else 0.2
        plt.errorbar(
            x=x_pos + hue_offset,
            y=row['mean_accuracy'],
            yerr=[[row['mean_accuracy'] - row['ci_lower']], 
                  [row['ci_upper'] - row['mean_accuracy']]],
            fmt='none',
            capsize=5,
            color='black'
        )
    
    # overlay GLM predicted probabilities
    if show_model:
        for i, row in summary_df.iterrows():
            x_pos = list(summary_df['chart_type'].unique()).index(row['chart_type'])
            hue_offset = -0.2 if row['permuted'] == 'ordered' else 0.2
            plt.errorbar(
                x=x_pos + hue_offset,
                y=row['predicted_probability'],
                yerr=row['sd_probability'],
                fmt='o',
                color='red',
                markersize=5,
                label='Model prediction' if i == 0 else None
            )
    
    plt.ylabel("Accuracy")
    plt.xlabel("Chart Type")
    plt.ylim(0,1)
    plt.title("Accuracy by Chart Type and Permutation")
    plt.legend(title='Permutation')
    plt.tight_layout()
    plt.show()


if __name__ == "__main__":
    df = load_data()

    result = mixed_logistical_regression(df)
    pred_df = report_table(result)
    boot_df = compute_bootstrap_summary(df)

    summary_df = boot_df.merge(pred_df, on=["chart_type", "permuted"])
    summary_df = summary_df.round({
        "mean_accuracy": 3,
        "ci_lower": 3,
        "ci_upper": 3,
        "predicted_probability": 3,
        "sd_probability": 3
    })
    print(summary_df)

    plot_accuracy_bars(summary_df)
    
