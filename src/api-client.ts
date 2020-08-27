var PROTO_PATH = __dirname + '/protos/api.proto';

var grpc = require('grpc');
var protoLoader = require('@grpc/proto-loader');
var packageDefinition = protoLoader.loadSync(
    PROTO_PATH,
    {
        keepCase: true,
        longs: String,
        enums: String,
        defaults: true,
        oneofs: true
    });
var api_proto = grpc.loadPackageDefinition(packageDefinition).communicationsapi;

function main() {
    var client = new api_proto.CommunicationsApi('localhost:50051',
        grpc.credentials.createInsecure());
    var user;
    if (process.argv.length >= 3) {
        user = process.argv[2];
    } else {
        user = 'Raulo';
    }
    runConnectToNode((error: any, response: any) => {
        console.log("CONNECTION ENDED");
        console.log(error);
        console.log(response);
    }, client);

    subscribeToChannel("MiCanal1", client);

    /*pingServer((error:any, response: any) => {
        console.log((error)?error:"OK");
        console.log(response)
    }, client);*/

}

function subscribeToChannel(topic: string, client: any): void {
    client.subscribe({ channelId: topic }, (error: any, response: any) => {
        console.log(`Subscription status: ${response.message}`);
        console.log("Now sending message");
        let buf = Buffer.from('Hello World', 'utf8');

        client.publish({ topic: topic, message:buf}, (error: any, response: any) => {
            console.log("PUBLISH STATUS:");
            console.log(response);
        });
    });
}


function pingServer(callback: any, client: any): void {
    client.pingChannel({}, callback);
}

function runConnectToNode(callback: any, client: any): void {
    var call = client.connectToCommunicationsNode({});

    call.on('data', (notification: any) => {
        console.log(notification);
        /*client.pingChannel({}, (error:any, response: any) => {
            console.log((error)?error:"OK");
            console.log(response)
        });*/

    });


    call.on('end', callback);
}

main();