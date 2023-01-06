export default helpers;
declare namespace helpers {
    function escapeCharacters(characters: any): (string: any) => any;
    function escapeRegexString(string: any): any;
    function findFirstMatchInArray(array: any): (text: any) => any;
    function reduceTextFromReferences(text: any, refs: any): any;
}
