# This file contains the original python logic used to calculate the adaptive VLAT. Please see dynamic.tsx for the javascript implementation used by reVISit

from collections import OrderedDict
import pandas as pd
import numpy as np
from scipy.stats import norm
import operator


def irt_likelihood_correct(a, b, theta):
    return 1/(1+np.exp(-a*(theta+b)))


def irt_likelihood_wrong(a, b, theta):
    return 1 - 1/(1+np.exp(-a*(theta+b)))


def item_info_func(a, b, theta):
    return a**2 * irt_likelihood_correct(a, b, theta) * irt_likelihood_wrong(a, b, theta)


def df_to_dict(df):
    new_dict = dict()
    df_list = df.values.tolist()
    unused_chart_task_set = set()
    for i in df_list:
        new_dict[i[0]] = (i[1], i[2], i[3], i[4])
        unused_chart_task_set.add(i[3])
        unused_chart_task_set.add(i[4])
    return new_dict, unused_chart_task_set



def adaptive_vlat(response_history_dict):
    """Run adaptive algorithm on item response history to select the next item

    Keyword arguments:
        response_history_dict (OrderedDict) -- an ordered dictonary with item id as keys and item correctness as values

    Returns:
        next_item (str) -- the item ID of the next item
    """

    theta_test_tryout = pd.read_csv('data/df_VLAT_ability.csv')
    item_parameters = pd.read_csv('data/df_VLAT_param_medians.csv')

    item_parameters, unused_chart_task_set = df_to_dict(item_parameters)
    used_chart_task_combo = set()

    # Get the ability of the participants from test tryout data
    ability_test_tryout = theta_test_tryout.iloc[:, 0:1].values
    # Get the mean of ability from test tryout data
    initial_prior_mean = np.mean(ability_test_tryout)
    # Get the standard deviation of ability from test tryout data
    initial_prior_std = np.std(ability_test_tryout)

    # Build a grid for grid approximation
    grid_data = np.linspace(-5, 5, 200)
    # Build the initial prior distribution
    prior = norm.pdf(grid_data, initial_prior_mean, initial_prior_std)

    if len(response_history_dict) == 0:  # If we are picking the first item
        # Then set current ability to the mean of the prior distribution
        current_ability = initial_prior_mean

    else:
        # Iterate over the items answered so far
        for key, value in response_history_dict.items():
            item_easiness = item_parameters[key][0]
            item_discrimination = item_parameters[key][1]
            item_correctness = value

            # Remove chart types and tasks of answered items from unused_chart_task_set
            if item_parameters[key][2] in unused_chart_task_set:
                unused_chart_task_set.remove(item_parameters[key][2])
            if item_parameters[key][3] in unused_chart_task_set:
                unused_chart_task_set.remove(item_parameters[key][3])

            # Add chart type and task combo of answered item to used_chart_task_combo
            used_chart_task_combo.add(
                (item_parameters[key][2], item_parameters[key][3]))

            if item_correctness == 0:  # If answered incorrectly, invoke the corresponding likelihood function
                likelihood = irt_likelihood_wrong(
                    a=item_discrimination, b=item_easiness, theta=grid_data)

            else:  # If answered correctly, invoke the corresponding likelihood function
                likelihood = irt_likelihood_correct(
                    a=item_discrimination, b=item_easiness, theta=grid_data)

            unnormalized_posterior = likelihood * prior
            posterior = unnormalized_posterior / unnormalized_posterior.sum()
            # Update the prior for the next iteration to be the posterior of the current iteration
            prior = posterior
        # Compute the current estimated ability by taking the weighted mean of the posterior
        current_ability = sum(posterior * grid_data)
    # Create dictionary to store remaining items and their item information
    item_info_dict = dict()
    num_left = 27 - len(response_history_dict)

    if len(unused_chart_task_set) == 0:
        for key, value in item_parameters.items():
            # If item not used yet, compute its item infomation given the current ability
            if key not in response_history_dict:
                item_info = item_info_func(value[1], value[0], current_ability)
                item_info_dict[key] = item_info
        next_item = max(item_info_dict.items(), key=operator.itemgetter(1))[
            0]  # Get the next item that has the maximum item information

    elif num_left > len(unused_chart_task_set):
        for key, value in item_parameters.items():
            # If item not used yet, compute its item infomation given the current ability
            if (value[2], value[3]) not in used_chart_task_combo:
                item_info = item_info_func(value[1], value[0], current_ability)
                item_info_dict[key] = item_info
        next_item = max(item_info_dict.items(), key=operator.itemgetter(1))[
            0]  # Get the next item that has the maximum item information
    else:
        for key, value in item_parameters.items():
            # If item not used yet, compute its item infomation given the current ability
            if (value[2] in unused_chart_task_set) or (value[3] in unused_chart_task_set):
                item_info = item_info_func(value[1], value[0], current_ability)
                item_info_dict[key] = item_info
        next_item = max(item_info_dict.items(), key=operator.itemgetter(1))[
            0]  # Get the next item that has the maximum item information

    return next_item,current_ability  # Return item ID for next item



def getVLATnextqid(qid, correct):
    response_history_dict = OrderedDict()
    for i in range(len(qid)):
        response_history_dict[int(qid[i])] = int(correct[i])

    item_id, score = adaptive_vlat(
        response_history_dict=response_history_dict
    )

    print(item_id)
    print(score)
    return item_id, score

