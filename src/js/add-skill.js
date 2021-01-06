import React from 'react';
import Col from 'react-bootstrap/Col';
import {Typeahead} from 'react-bootstrap-typeahead';


/**
 * Add recipe component
 */
export default class AddSkill extends React.Component {
    constructor(props) {
        super(props);
        this.handleChange = this.handleChange.bind(this);
        this.typeahead = React.createRef();
    }

    handleChange(selected){
        this.props.onAddSkill(selected[0].id);
        this.typeahead.current.clear();
    }

    render() {
        const localization = this.props.localization;
        const options = this.props.skills
            .filter(value => localization[value])
            .map(value => ({id:value, label: localization[value]}))
            .sort((a,b) => a.label.localeCompare(b.label));
        console.log('handle', this.handleChange);

        return (
            <Col>
                <Typeahead
                    id="add-skill"
                    ref={this.typeahead}
                    options={options}
                    onChange={this.handleChange}
                    placeholder="Choose a skill..."
                />
            </Col>
        );
    }
}
