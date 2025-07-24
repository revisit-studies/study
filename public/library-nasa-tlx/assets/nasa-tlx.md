
# nasa-tlx

import StructuredLinks from '@site/src/components/StructuredLinks/StructuredLinks.tsx';

<StructuredLinks
    demoLinks={[
      {name: "nasa-tlx Demo", url: "https://revisit.dev/study/library-nasa-tlx"}
    ]}
    codeLinks={[
      {name: "nasa-tlx Code", url: "https://github.com/revisit-studies/study/tree/main/public/library-nasa-tlx"}
    ]}
    referenceLinks={[
      {name: "DOI", url: "https://dx.doi.org/10.1016/S0166-4115(08)62386-9"}
      
    ]}
/>

This is an example study of the library `nasa-tlx`.

The NASA-TLX is a widely used subjective workload assessment tool. It consists of six subscales: Mental Demand, Physical Demand, Temporal Demand, Performance, Effort, and Frustration. The NASA-TLX is designed to assess the perceived workload of a task and is commonly used in human factors and ergonomics research. We provide a component of the NASA-TLX itself, and a sequence that includes a source of load evaluation. The source of load evaluation is based on the pairwise weighting procedure described in the NASA-TLX manual.

## Reference

Hart, Sandra G., and Lowell E. Staveland. "Development of NASA-TLX (Task Load Index): Results of empirical and theoretical research." Advances in psychology. Vol. 52. North-Holland, 1988. 139-183.

DOI: [10.1016/S0166-4115(08)62386-9](https://dx.doi.org/10.1016/S0166-4115(08)62386-9)



## Available Components

- nasa-tlx
- source-of-load

## Available Sequences

- nasa-tlx-with-source-of-load-evaluation
