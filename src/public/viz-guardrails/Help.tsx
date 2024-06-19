/* eslint-disable import/no-cycle */
import {
  HoverCard, Button, Text, Group, TypographyStylesProvider,
} from '@mantine/core';
import { ChartParams } from './DataExplorer';

export function Help({
  parameters,
} : {
    parameters: ChartParams
}) {
  const helpText = (parameters.dataset === 'clean_data'
    ? (
      <TypographyStylesProvider>
        Select any subset of countries to the left of the visualization to support the prompt at the top of the page.
        <h4>Background:</h4>
        You live in a fantasy world that consists of your home country, as well as other
        15 countries located across 5 continents: Eldoril, Thundoril, Aerion, Silvoria, and Mystara.
        Countries within each continent are similar to each other in size and demographics.
        <h4>Scenario:</h4>
        You are an analyst for the Viral Disease Policy Center of your home country at time when there is a new
        viral disease called
        <i> Celestial Sniffles</i>
        . Luckily, your country has not been affected yet
        and has time to prepare and decide on a policy to combat it. You have access to the infection
        data from other countries that implemented one of the 3 available policies: A, B, or C.
        However, due to socioeconomic factors, the Surgeon General in your country has
        <i> already decided on a policy</i>
        .
        <h4>Task:</h4>
        You are tasked with leading the promotion efforts that make the case for the chosen policy.
        In the experiment, you will use an interactive data explorer that shows infection data from other countries.
        You should select a view that best shows (and convinces the population) that your country&apos;s
        {' '}
        <b>
          chosen
          policy is the best policy to combat the disease
        </b>
        . After finalizing the view, click the
        camera button and add a caption or a slogan that will go along with your visualization.
      </TypographyStylesProvider>
    )
    : (
      <TypographyStylesProvider>
        Select any subset of stocks to the left of the visualization to support the prompt at the top of the page.
        <h4>Scenario:</h4>
        {' '}
        You are a financial advisor. Your client approached you asking for help in
        picking a new investment&mdash;an industry fund that equally invests within a single industry.
        The client prefers to make their decisions
        {' '}
        <i>solely based on the data</i>
        , and not based on
        any inside knowledge about the type of industry.
        However, your boss
        {' '}
        <i>does</i>
        {' '}
        have inside knowledge and orders you to recommend a specific industry (which is ultimately in the best interest of the client).
        You cannot disclose this to the client and have to use data to support your recommendations.
        <h4>Task:</h4>
        {' '}
        In the experiment, you will use an interactive data explorer that shows performance
        of different stocks from a variety of industries.
        You should select a view that best shows (and convinces your client) that
        {' '}
        <b>
          the chosen
          industry fund would be the best investment with the highest returns
        </b>
        . After finalizing the view,
        click the camera button and add a caption or a slogan that will go along with your visualization.
      </TypographyStylesProvider>
    )
  );

  const helpText2 = (parameters.dataset === 'clean_data'
    ? (
      <TypographyStylesProvider>
        <h4>Background:</h4>
        You live in a fantasy world that consists of your home country, as well as other
        15 countries located across 5 continents: Eldoril, Thundoril, Aerion, Silvoria, and Mystara.
        Countries within each continent are similar to each other in size and demographics.

        <h4>Scenario:</h4>
        There&apos;s a new viral disease called
        {' '}
        <i>Celestial Sniffles</i>
        .
        Most countries in the world have adopted one of 3 major disease containment policies: A, B, or C.
        Luckily, your country has not been affected yet but you may need to travel to one of the affected countries for work.
        Afraid of getting sick and stuck abroad with a huge hospital bill, you decide to purchase a traveler&apos;s health insurance policy.
        The price of the policy is very flexible and depends on the amount of coverage you&apos;ll get:
        anywhere between $0 (no coverage) to $100 (full coverage).

        Since you are not familiar with the disease trends or containment policies, you turn to social media to read what people shared about recent infection rates.

        <h4>Task:</h4>
        In the experiment, you will see a set of visualizations that show infection rates in different countries that adopted
        one of the containment policies A, B, or C.
        You can refer to the list of countries to the left of the visualization to see which country adopted which Policy.
        Based on each visualization, you will be asked to decide
        {' '}
        <b>how much to spend on your insurance policy</b>
        {' '}
        and
        {' '}
        <b>answer a short survey</b>
        .
      </TypographyStylesProvider>
    ) : (
      <TypographyStylesProvider>
        <h4>Scenario:</h4>
        You have $100 that you would like to invest in
        {' '}
        <i>industry funds</i>
        {' '}
        but are not sure how to best allocate that money.
        An industry fund is composed of all individual stocks pertaining to that industry (e.g., a Pharma fund is composed of Pharma A, Pharma B, and Pharma C stocks).
        Since you are not familiar with the current market, you turn to social media to read what people shared about recent stock performance.

        <h4>Task:</h4>
        In the experiment, you will see a set of visualizations that show performance of different stocks from a variety of industries.
        Based on each visualization, you will be asked to decide
        {' '}
        <b>how much to invest in a given industry fund</b>
        {' '}
        and
        {' '}
        <b>answer a short survey</b>
        .
      </TypographyStylesProvider>
    )
  );

  return (
    <Group justify="right">
      <HoverCard width={800} shadow="md">
        <HoverCard.Target>
          <Button variant="light" color="gray" size="compact-sm">Help</Button>
        </HoverCard.Target>
        <HoverCard.Dropdown>
          <Text size="sm">
            {parameters.allow_selection ? helpText : helpText2}
          </Text>
        </HoverCard.Dropdown>
      </HoverCard>
    </Group>
  );
}
