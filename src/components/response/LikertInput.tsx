import RadioInput from './RadioInput';


type inputProps = {
    title: string,
    desc: string,
    likertPreset: string,
    required: boolean,
    answer:object
}

export default function LikertInput({ title='Your Question', desc='additional description', likertPreset='5', answer , required}: inputProps) {

    const radioData = [];
    for (let i = 1; i <= +likertPreset; i++) {
        radioData.push({label: `${i}`, value: `${i}`});
    }

    return (
        <>
            <RadioInput title={title} desc={desc} radioData={radioData} answer={answer} required={required}/>
        </>
    );
}
