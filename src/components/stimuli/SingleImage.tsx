import { Image, Box } from '@mantine/core';

const SingleImage = (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    props: any,
    width = 400,
    height = 400
) => {
    const imgpath = props.parameters.imagePath;

    return(
        <Box style={{marginTop:20}}>
            <Image width={width} maw={800} miw={400} src={imgpath} />
        </Box>
    );

};
export default SingleImage;