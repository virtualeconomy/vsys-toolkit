const date = new Date().toJSON().slice(0, 10);

module.exports = {
    reporter: 'node_modules/mochawesome',
    'reporter-option': [
        `reportFilename=${date}`,
        'overwrite=false',
        'reportDir=test/report'
    ],
};