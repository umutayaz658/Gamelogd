declare module 'react-giphy-picker' {
    import { Component, CSSProperties, ReactNode } from 'react';

    export interface PickerProps {
        apiKey?: string;
        onSelected?: (gif: any) => void;
        visible?: boolean;
        modal?: boolean;
        style?: CSSProperties;
        searchBoxStyle?: CSSProperties;
        gifStyle?: CSSProperties;
        scrollComponent?: (props: any) => ReactNode;
    }

    export default class Picker extends Component<PickerProps> { }
}
