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
    runConnectToNode(client);

    subscribeToChannel("MiCanal1", client);

}

function subscribeToChannel(topic: string, client: any): void {
    client.subscribe({ channelId: topic }, (subscriptiomError: any, response: any) => {
        if (subscriptiomError) {
            console.log(`Subscription status error: ${subscriptiomError}`);
        }
        else {
            console.log("Now sending message");
            let msg = Buffer.from('Hello World', 'utf8');


            client.publish({ topic: { channelId: topic }, message: { payload: msg } }, (error: any, response: any) => {
                if (error) {
                    console.log("Error in Publish :");
                    console.log(error);
                }
                else {
                    console.log('ASKING FOR SUBSCRIBER');
                    client.hasSubscriber({ peerId: 'kaka', channel: { channelId: topic } },
                        (error: any, response: any) => {
                            if (error) {
                                console.log(error);
                            } else {
                                console.log(response);
                            }
                        })
                }
            });
        }

    });
}


function runConnectToNode(client: any): void {
    var call = client.connectToCommunicationsNode({});

    call.on('data', (response: any) => {

        if (response.notification_type == 'channelNewData') {
            console.log("/////////////////////////////");
            console.log("New subscription data");
            console.log(`Channel(s): ${JSON.stringify(response.channelNewData.channel)}`);
            console.log(`Published by: ${response.channelNewData.from}`);
            console.log(`Message: ${Buffer.from(JSON.parse(response.channelNewData.data).data).toString()}`);
            console.log(`Nonce: ${response.channelNewData.nonce.toString('hex')}`);
            console.log("/////////////////////////////");
        }
        else {
            console.log("Unknown message type received though the grpc server stream");
            console.log(response);
        }


    });


    call.on('end', (error: any, response: any) => {
        if (error) {
            console.log(error);
        }
        else {
            console.log(response);
            console.log("Connection ended");
        }
    });
}

main();